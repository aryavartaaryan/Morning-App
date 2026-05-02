import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Animated, Dimensions, ActivityIndicator, ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { speakBodhi, stopBodhi } from '@/lib/speech';
import { auth, db } from '@/lib/firebase';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { scheduleNativeAlarm } from '@/lib/nativeAlarm';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';
import { getPrakritiPlan, PledgeData, WAKE_MISSIONS, WakeMission, shiftActivitiesToWake, getLocationAwareWakeOptions } from '@/lib/prakritiPlan';
import {
  requestLocation, buildLocationProfile, getBrahmaMuhurtaResult,
  CLIMATE_LABELS, SEASON_LABELS, getAyurvedicSeason,
  type LocationProfile, type BrahmaMuhurtaResult,
} from '@/lib/locationIntel';
import { scheduleBrahmaMuhurtaAlarm } from '@/lib/nativeAlarm';

// ── Types ──────────────────────────────────────────────────────────────────
type StepType = 'text' | 'choice' | 'multi';
interface LOption { id: string; label: string; desc?: string; }
interface LifeStep {
  id: string; emoji: string; q: string; sub?: string;
  type: StepType; options?: LOption[]; placeholder?: string;
}

// ── Lifestyle Steps — English ───────────────────────────────────────────────
const LIFE_EN: LifeStep[] = [
  {
    id: 'intentions', emoji: '🌿', type: 'multi',
    q: 'What brings you to OneSutra?',
    sub: "We'll personalize your journey based on your intentions.",
    options: [
      { id: 'discipline', label: '🌅 Build Discipline', desc: 'Consistent daily rituals' },
      { id: 'anxiety', label: '🌊 Reduce Anxiety', desc: 'Find calm and inner peace' },
      { id: 'happiness', label: '🌸 Increase Happiness', desc: 'Cultivate daily joy' },
      { id: 'performance', label: '⚡ Improve Performance', desc: 'Peak mental clarity & focus' },
      { id: 'sleep', label: '🌙 Better Sleep', desc: 'Deep, restorative rest' },
      { id: 'stress', label: '🍃 Reduce Stress', desc: 'Balance your nervous system' },
      { id: 'wellness', label: '🌿 Holistic Wellness', desc: 'Align mind, body & spirit' },
      { id: 'purpose', label: '🔱 Deepen Spirituality', desc: 'Connect with your dharma' },
    ],
  },
  {
    id: 'name', emoji: '✨', type: 'text',
    q: 'What is your name?',
    sub: 'Your name will appear across OneSUTRA.',
    placeholder: 'Enter your name...',
  },
  {
    id: 'dob', emoji: '🎂', type: 'text',
    q: 'Please share your birth date with me.',
    sub: 'Optional — you can skip this if you prefer.',
    placeholder: 'DD/MM/YYYY',
  },
  {
    id: 'occupation', emoji: '💼', type: 'choice',
    q: 'What do you do?',
    sub: 'Helps focus your productivity tools.',
    options: [
      { id: 'student', label: '📚 Student', desc: 'Learning and growing' },
      { id: 'professional', label: '💼 Professional', desc: 'Working in a job or career' },
      { id: 'creative', label: '🎨 Creative / Artist', desc: 'Creative work or freelancing' },
      { id: 'entrepreneur', label: '🚀 Entrepreneur', desc: 'Running a business' },
      { id: 'home_maker', label: '🏠 Home Maker', desc: 'Managing home and family' },
    ],
  },
  {
    id: 'gender', emoji: '🌸', type: 'choice',
    q: 'What is your gender?',
    sub: 'We welcome everyone.',
    options: [
      { id: 'male', label: '♂️ Male' },
      { id: 'female', label: '♀️ Female' },
      { id: 'non_binary', label: '⚧️ Non-Binary' },
      { id: 'prefer_not', label: '🤝 Prefer not to say' },
    ],
  },
  {
    id: 'wakeTimeNatural', emoji: '😴', type: 'choice',
    q: 'What time do you naturally wake up right now?',
    sub: 'Be honest — no judgment here.',
    options: [
      { id: 'before_5', label: '🌙 Before 5 AM', desc: 'Early bird already' },
      { id: '5_to_6', label: '🌅 5 – 6 AM', desc: 'Brahma Muhurta zone' },
      { id: '6_to_7', label: '☀️ 6 – 7 AM', desc: 'Sattvic morning' },
      { id: '7_to_8', label: '🌤️ 7 – 8 AM', desc: 'Kapha territory' },
      { id: 'after_8', label: '💤 After 8 AM', desc: 'Needs a system change' },
    ],
  },
  {
    id: 'morningStruggle', emoji: '😩', type: 'choice',
    q: 'Your biggest morning battle?',
    sub: 'We will build your alarm around this.',
    options: [
      { id: 'snooze', label: '😴 Snooze Machine', desc: 'Hit snooze 3+ times every day' },
      { id: 'brain_fog', label: '🧠 Brain Fog', desc: 'Takes 1+ hour to feel human' },
      { id: 'no_motive', label: '😫 No Motivation', desc: 'Why even get up?' },
      { id: 'phone_trap', label: '📱 Phone Trap', desc: 'Check phone before standing up' },
      { id: 'all_good', label: '✅ I\'m Actually Fine', desc: 'Just here to optimize' },
    ],
  },
];

// ── Lifestyle Steps — Hindi (website-matched, aap respectful) ───────────────
const LIFE_HI: LifeStep[] = [
  {
    id: 'intentions', emoji: '🌿', type: 'multi',
    q: 'OneSutra में आप क्यों आए हैं?',
    sub: "हम आपके इरादों के आधार पर आपकी यात्रा को व्यक्तिगत बनाएंगे।",
    options: [
      { id: 'discipline', label: '🌅 अनुशासन बनाना', desc: 'नियमित दैनिक अनुष्ठान' },
      { id: 'anxiety', label: '🌊 चिंता कम करना', desc: 'शांति और आंतरिक स्थिरता' },
      { id: 'happiness', label: '🌸 खुशी बढ़ाना', desc: 'रोज़ आनंद पाना' },
      { id: 'performance', label: '⚡ प्रदर्शन सुधारना', desc: 'मानसिक स्पष्टता और फोकस' },
      { id: 'sleep', label: '🌙 बेहतर नींद', desc: 'गहरी, तरोताज़ा नींद' },
      { id: 'stress', label: '🍃 तनाव घटाना', desc: 'नर्वस सिस्टम को संतुलित करें' },
      { id: 'wellness', label: '🌿 समग्र स्वास्थ्य', desc: 'मन, शरीर और आत्मा का संतुलन' },
      { id: 'purpose', label: '🔱 आध्यात्मिकता', desc: 'अपने धर्म से जुड़ें' },
    ],
  },
  {
    id: 'name', emoji: '✨', type: 'text',
    q: 'आपका नाम क्या है?',
    sub: 'आपका नाम OneSUTRA में दिखाया जाएगा।',
    placeholder: 'अपना नाम लिखें...',
  },
  {
    id: 'dob', emoji: '🎂', type: 'text',
    q: 'कृपया मुझे अपनी जन्म तारीख बताएं।',
    sub: 'चाहें तो बता सकते हैं, या छोड़ सकते हैं।',
    placeholder: 'DD/MM/YYYY',
  },
  {
    id: 'occupation', emoji: '💼', type: 'choice',
    q: 'आप क्या काम करते हैं?',
    sub: 'आपके उत्पादकता उपकरणों को केंद्रित करने में मदद करता है।',
    options: [
      { id: 'student', label: '📚 विद्यार्थी', desc: 'पढ़ाई और सीखना' },
      { id: 'professional', label: '💼 नौकरीपेशा', desc: 'किसी पद या करियर में काम' },
      { id: 'creative', label: '🎨 रचनात्मक / कलाकार', desc: 'रचनात्मक या फ्रीलांस काम' },
      { id: 'entrepreneur', label: '🚀 उद्यमी', desc: 'व्यवसाय चलाना' },
      { id: 'home_maker', label: '🏠 गृहिणी', desc: 'घर और परिवार संभालना' },
    ],
  },
  {
    id: 'gender', emoji: '🌸', type: 'choice',
    q: 'आपका लिंग क्या है?',
    sub: 'हम सभी का स्वागत करते हैं।',
    options: [
      { id: 'male', label: '♂️ पुरुष' },
      { id: 'female', label: '♀️ महिला' },
      { id: 'non_binary', label: '⚧️ नॉन-बाइनरी' },
      { id: 'prefer_not', label: '🤝 बताना नहीं चाहते' },
    ],
  },
  {
    id: 'wakeTimeNatural', emoji: '😴', type: 'choice',
    q: 'आप अभी स्वाभाविक रूप से कितने बजे उठते हैं?',
    sub: 'ईमानदारी से बताएं — कोई निर्णय नहीं।',
    options: [
      { id: 'before_5', label: '🌙 5 बजे से पहले', desc: 'पहले से ही अर्ली बर्ड' },
      { id: '5_to_6', label: '🌅 5 – 6 AM', desc: 'ब्रह्म मुहूर्त काल' },
      { id: '6_to_7', label: '☀️ 6 – 7 AM', desc: 'सात्त्विक सुबह' },
      { id: '7_to_8', label: '🌤️ 7 – 8 AM', desc: 'कफ काल' },
      { id: 'after_8', label: '💤 8 बजे बाद', desc: 'सिस्टम चाहिए' },
    ],
  },
  {
    id: 'morningStruggle', emoji: '😩', type: 'choice',
    q: 'सुबह उठने में सबसे बड़ी समस्या क्या है?',
    sub: 'हम आपका अलार्म इसी के हिसाब से बनाएंगे।',
    options: [
      { id: 'snooze', label: '😴 Snooze आदत', desc: 'रोज़ 3+ बार स्नूज़ दबाते हैं' },
      { id: 'brain_fog', label: '🧠 दिमाग में धुंध', desc: '1+ घंटे बाद सही होते हैं' },
      { id: 'no_motive', label: '😫 मन नहीं लगता', desc: 'उठने का मन ही नहीं होता' },
      { id: 'phone_trap', label: '📱 Phone की लत', desc: 'उठने से पहले Phone चेक' },
      { id: 'all_good', label: '✅ ठीक हैं', desc: 'बस और बेहतर करना है' },
    ],
  },
];

const getSteps = (lang: string): LifeStep[] =>
  (lang === 'hi' || lang === 'sa') ? LIFE_HI : LIFE_EN;

const BODHI_INTRO: Record<string, string> = {
  en: "I'm Bodhi — your companion on this journey, like a friend who truly knows you. No lectures, no pressure. I'm here to help you discover what works for you, in your own way.",
  hi: "मैं बोधि हूँ — आपका साथी इस यात्रा में। एक ऐसा मित्र जो आपको समझे। कोई lecture नहीं, कोई pressure नहीं। बस आपके लिए क्या सही है, वो मिलकर जानते हैं।",
};

const { width, height } = Dimensions.get('window');
const GEMINI_KEY = 'AIzaSyANg_oPfwORFiYwvWCs53hO2NSiw96xA8k';
const BG = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=90&auto=format&fit=crop';

// ── Prakriti Quiz ─────────────────────────────────────────
interface Answer { id: string; label: string; desc: string; v: number; p: number; k: number; }
interface Question { id: string; emoji: string; q: string; sub?: string; answers: Answer[]; }

// Body: Q0-9 | Mind: Q10-16 | Emotions: Q17-21
const QUIZ: Question[] = [
  {
    id: 'frame', emoji: '🪶', q: 'Your body frame since childhood?', sub: 'Select all that resonate.', answers: [
      { id: 'a', label: 'Thin, light, bony — hard to gain weight', desc: 'Lean, prominent joints', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Medium, muscular, well-proportioned', desc: 'Athletic, stable weight', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Large, broad, solid — gains weight easily', desc: 'Heavy frame, sturdy', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'skin', emoji: '🌸', q: 'Your skin texture and tendency?', sub: 'Select all that apply.', answers: [
      { id: 'a', label: 'Dry, rough, thin — prone to cracking', desc: 'Cool to touch, darkens easily', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Warm, reddish, sensitive — flushes easily', desc: 'Burns in sun, freckles', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Oily, smooth, thick — ages slowly', desc: 'Naturally moisturized, soft', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'hair', emoji: '💆', q: 'Your natural hair quality?', answers: [
      { id: 'a', label: 'Dry, frizzy, brittle — breaks easily', desc: 'Thin, dark, curly or wavy', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Fine, straight — premature greying', desc: 'Silky but prone to early changes', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Thick, lustrous, slightly oily', desc: 'Grows abundantly', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'eyes', emoji: '👁️', q: 'The natural quality of your eyes?', answers: [
      { id: 'a', label: 'Small, restless, dry — blinks often', desc: 'Dark or grey, nervous gaze', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Medium, sharp, penetrating', desc: 'Light-sensitive, intense gaze', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Large, calm, beautiful — thick lashes', desc: 'Deep brown, steady gaze', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'appetite', emoji: '🍽️', q: 'Your natural hunger and appetite?', sub: 'Select all that resonate.', answers: [
      { id: 'a', label: 'Irregular — ravenous or suddenly absent', desc: 'Variable, forgets meals', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Intense, sharp — irritable if meals are late', desc: 'Must eat on time', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Mild, steady — can skip meals easily', desc: 'Slow Agni, light portions', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'digestion', emoji: '🔥', q: 'How does your body digest food?', answers: [
      { id: 'a', label: 'Variable — bloating, gas, constipation', desc: 'Irregular Agni', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Fast, sharp — may get acid or heartburn', desc: 'Strong Agni, overheats', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Slow, heavy — sluggish after eating', desc: 'Mucus tendency', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'sweat', emoji: '💧', q: 'Your perspiration pattern?', sub: 'Select all that apply.', answers: [
      { id: 'a', label: 'Minimal — dry even in intense heat', desc: 'Rarely sweats', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Profuse — overheats easily, sharp scent', desc: 'Body runs hot', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Moderate, consistent — mild scent', desc: 'Balanced sweating', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'temp', emoji: '🌡️', q: 'Your body temperature preference?', answers: [
      { id: 'a', label: 'Always cold — craves warmth and heat', desc: 'Cold hands and feet', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Always hot — craves cool and fresh air', desc: 'Dislikes direct sun', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Adaptable — but dislikes cold and damp', desc: 'Damp is main trigger', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'energy', emoji: '⚡', q: 'How does your physical energy flow?', sub: 'Select all that are true.', answers: [
      { id: 'a', label: 'Bursts of intensity, then sudden exhaustion', desc: 'Overdo then crash', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Sustained, intense, driven — can burn out', desc: 'Competitive, focused', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Slow warm-up, then enduring stamina', desc: 'Reliable once moving', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'joints', emoji: '🦴', q: 'Your joints and physical structure?', answers: [
      { id: 'a', label: 'Thin, prominent — crack often, hypermobile', desc: 'Audible cracking', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Moderate, flexible, well-defined', desc: 'Good tone and flexibility', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Large, well-padded, stable — rarely crack', desc: 'Heavy, dense, strong', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'learning', emoji: '📚', q: 'How do you learn and retain information?', sub: 'Select all that apply.', answers: [
      { id: 'a', label: 'Quick to grasp, quick to forget', desc: 'Learn fast, need repetition', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Sharp, analytical — excellent recall', desc: 'Precise, retains well', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Slow to learn, retains for life once absorbed', desc: 'Deep long-term memory', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'decisions', emoji: '🧭', q: 'How do you make decisions?', answers: [
      { id: 'a', label: 'Quickly — but often second-guess yourself', desc: 'Impulsive, changes mind', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Quickly and decisively — rarely backtracks', desc: 'Confident, can be stubborn', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Slowly and carefully — needs time to commit', desc: 'Deliberate, once decided: firm', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'sleep', emoji: '🌙', q: 'Your natural sleep quality?', sub: 'Choose all that resonate.', answers: [
      { id: 'a', label: 'Light, disturbed — vivid or anxious dreams', desc: 'Wake often at night', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Moderate — fall asleep easily, may wake once', desc: 'Vivid purposeful dreams', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Deep, long — hard to wake, groggy mornings', desc: 'Loves long heavy sleep', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'mind_pace', emoji: '🧠', q: 'How does your mind naturally operate?', sub: 'Select all that apply.', answers: [
      { id: 'a', label: 'Fast, creative, scattered — many ideas at once', desc: 'Jumps topics, hard to focus', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Sharp, focused, analytical — cuts to the point', desc: 'Logical, penetrating', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Calm, steady, methodical — slow but thorough', desc: 'Processes deeply', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'speech', emoji: '🗣️', q: 'Your natural speech and communication style?', answers: [
      { id: 'a', label: 'Fast, enthusiastic — talks a lot, sometimes rambles', desc: 'Energetic, lively', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Direct, precise, sharp — straight to the point', desc: 'Articulate, confident', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Slow, melodious — speaks only when needed', desc: 'Soft-spoken, comforting', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'thirst', emoji: '🫗', q: 'Your natural thirst pattern?', answers: [
      { id: 'a', label: 'Variable — often forgets to drink water', desc: 'Often dehydrated', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Strong, frequent — craves cool water', desc: 'Regularly thirsty', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Minimal — can go hours without water', desc: 'Rarely feels thirsty', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'focus', emoji: '🎯', q: 'Your focus and work style?', sub: 'Select all that match.', answers: [
      { id: 'a', label: 'Multitask constantly — hard to finish one thing', desc: 'Start many, complete few', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Intensely focused on one goal at a time', desc: 'May sacrifice rest', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Methodical, consistent — finishes everything', desc: 'Steady, needs push to begin', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'stress', emoji: '🌀', q: 'How do you respond to stress?', sub: 'Select all that resonate.', answers: [
      { id: 'a', label: 'Anxiety, overthinking, racing thoughts, insomnia', desc: 'Fear and worry dominate', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Anger, frustration, irritability, sharp words', desc: 'Heat rises, may lash out', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Withdrawal, heaviness, avoidance', desc: 'Retreats, becomes lethargic', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'emotions', emoji: '💭', q: 'Your baseline emotional nature?', sub: 'Choose all that apply.', answers: [
      { id: 'a', label: 'Enthusiastic, creative — but anxious', desc: 'Changeable, sensitive, empathetic', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Confident, passionate — can lose temper', desc: 'Natural leader, opinionated', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Patient, calm, nurturing — resists change', desc: 'Stable, loving, slow to anger', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'fear_anger', emoji: '⚖️', q: 'When disturbed, what arises most in you?', sub: 'Select all you recognise.', answers: [
      { id: 'a', label: 'Fear, anxiety, nervousness, insecurity', desc: 'Vata disturbance pattern', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Anger, jealousy, criticism, impatience', desc: 'Pitta disturbance pattern', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Greed, attachment, possessiveness', desc: 'Kapha disturbance pattern', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'relationships', emoji: '🤝', q: 'Your nature in relationships?', sub: 'Select all that resonate.', answers: [
      { id: 'a', label: 'Make friends quickly — many connections', desc: 'Warm, enthusiastic, variable', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Selective — few deep, intense, loyal bonds', desc: 'Quality over quantity', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Devoted long-term bonds — slow to open', desc: 'Nurturing, unconditional', v: 0, p: 0, k: 2 },
    ]
  },
  {
    id: 'purpose', emoji: '🙏', q: 'What drives you most deeply in life?', sub: 'Choose all that apply.', answers: [
      { id: 'a', label: 'Freedom, creativity, exploration, meaning', desc: 'Inspired by possibility', v: 2, p: 0, k: 0 },
      { id: 'b', label: 'Achievement, mastery, impact, recognition', desc: 'Driven by purpose', v: 0, p: 2, k: 0 },
      { id: 'c', label: 'Security, love, belonging, service to others', desc: 'Fulfilled by connection', v: 0, p: 0, k: 2 },
    ]
  },
];

interface DoshaInfo {
  emoji: string; color: string; title: string; desc: string; qualities: string;
  personality: string; dailyLife: string; dietTips: string[]; dinacharya: string[];
  bodhiSpeech: (name: string, pct: number, sec: string, secPct: number) => string;
}
const DOSHA_INFO: Record<string, DoshaInfo> = {
  Vata: {
    emoji: '🌬️', color: '#a78bfa', title: 'Vata Prakriti',
    desc: 'Creative, quick-moving and light — energy flows in bursts, mind thinks fast.',
    qualities: 'Air · Space · Movement · Creativity · Sensitivity',
    personality: 'Imaginative, enthusiastic and adaptable. Your mind races with ideas; you thrive on novelty and connect deeply with others. Anxiety and scatter arise when life feels uncertain.',
    dailyLife: 'Energy arrives in powerful bursts followed by sudden fatigue. Light sleep, vivid dreams, irregular hunger. Cold weather and multitasking drain you most. Warmth, routine and grounding restore you.',
    dietTips: ['Warm, oily, easily digestible foods — soups, stews, ghee', 'Eat at consistent times; avoid cold, raw or dry foods', 'Warm spiced milk at night calms the nervous system', 'Ginger tea before meals kindles Agni'],
    dinacharya: ['Wake 6–6:30 AM; sesame oil Abhyanga before bath', 'Barefoot morning walk on earth — slow grounded pace, 20–30 min', '10 min morning meditation in stillness', 'Sleep by 10 PM; phone-free 1 hour before bed'],
    bodhiSpeech: (n, pct, sec, sp) => `${n ? n + ', your' : 'Your'} Prakriti is Vata — ${pct} percent primary, with ${sec} at ${sp} percent as your secondary nature. Vata is Air and Space — the force of movement in body and mind. You are creative, quick-thinking and full of life. Your mind moves like the wind: fast, curious, always exploring. In daily life your energy comes in powerful bursts, but warmth, routine and rest keep you balanced. When Vata rises, anxiety, dryness and restless sleep appear. To ground yourself: eat warm oily nourishing foods, begin your day with sesame oil massage, sleep by ten, and breathe slowly. The wind is your greatest gift — OneSUTRA will give it direction.`,
  },
  Pitta: {
    emoji: '🔥', color: '#f97316', title: 'Pitta Prakriti',
    desc: 'Sharp, focused and passionate — fire drives ambition and precise intelligence.',
    qualities: 'Fire · Water · Transformation · Focus · Intensity',
    personality: 'Driven, articulate and deeply intelligent. You set high standards and lead naturally. Under pressure that fire can turn to irritability or burnout. You love challenge, debate and meaningful work.',
    dailyLife: 'Peak performance mid-morning. Heat, skipped meals or conflict disturb you most. Strong digestion but acid and skin flare-ups signal imbalance. Clear goals and purposeful action are your fuel.',
    dietTips: ['Cooling, sweet, bitter tastes — coconut, coriander, fennel, fresh fruit', 'Avoid spicy, fried or acidic food especially at noon', 'Pomegranate juice and mint water calm internal heat', 'Never skip meals — empty Pitta stomach creates fire without fuel'],
    dinacharya: ['Wake 5:30–6 AM; cooling coconut oil massage', 'Barefoot morning walk at a gentle pace — nature cools the fire', 'Meditate before 7 AM when the mind is cool', 'No screens or work emails after 9 PM'],
    bodhiSpeech: (n, pct, sec, sp) => `${n ? n + ', your' : 'Your'} Prakriti is Pitta — ${pct} percent primary, ${sec} at ${sp} percent secondary. Pitta is Fire and Water — the force of transformation. You are sharp, ambitious and precise. Your focus is formidable and your words carry weight. But when Pitta rises unchecked it becomes irritability, inflammation and exhaustion. To balance: eat cooling foods — coconut, coriander, fennel. Never skip meals. Cool water in the morning. Avoid aggressive stimulation in the evening. Practice a calm meditation before sunrise. Your fire is your greatest strength — OneSUTRA will help you direct it wisely.`,
  },
  Kapha: {
    emoji: '🌿', color: '#10b981', title: 'Kapha Prakriti',
    desc: 'Grounded, nurturing and steady — earth energy gives endurance and deep loyalty.',
    qualities: 'Earth · Water · Stability · Endurance · Compassion',
    personality: 'Warm, patient and deeply compassionate. You are the steady presence everyone leans on. Change comes slowly to you, but your loyalty and follow-through are unmatched. You excel at long-term commitment.',
    dailyLife: 'Slow to start but long-lasting energy once warm. Heavy sleep, groggy mornings, low appetite at dawn. Cold, damp weather and sedentary routines increase Kapha. Movement, lightness and stimulation bring out your best.',
    dietTips: ['Light, warm, spiced foods — ginger, black pepper, turmeric, honey', 'Avoid heavy, oily, cold, sweet or dairy-heavy meals', 'Warm lemon-ginger water first thing in the morning', 'Eat the largest meal at noon when Agni is strongest'],
    dinacharya: ['Wake by 5:30–6 AM before Kapha hour (6–10 AM)', 'Brisk barefoot walk on earth every morning — this single habit transforms Kapha', 'Dry brush massage (Garshana) to stimulate lymph', 'Light dinner before 7 PM; avoid napping in the day'],
    bodhiSpeech: (n, pct, sec, sp) => `${n ? n + ', your' : 'Your'} Prakriti is Kapha — ${pct} percent primary, ${sec} at ${sp} percent secondary. Kapha is Earth and Water — the force of stability and nourishment. You are warm, enduring and deeply compassionate. People feel safe around you. But when Kapha accumulates, it becomes heaviness, attachment and resistance to change. To balance: move vigorously every morning before six AM. Eat light warm spiced foods. Wake early before the Kapha hours begin. Your steadiness is a rare gift — OneSUTRA will help you channel it into daily action and vitality.`,
  },
};

const getQuiz = (_lang: string): Question[] => QUIZ;

const computePrakritiFromAnswers = (ans: Record<string, Answer[]>): string => {
  let v = 0, p = 0, k = 0;
  Object.values(ans).forEach(arr => arr.forEach(a => { v += (a.v || 0); p += (a.p || 0); k += (a.k || 0); }));
  const total = v + p + k || 1;
  const doshas = [
    { name: 'Vata', pct: Math.round((v / total) * 100) },
    { name: 'Pitta', pct: Math.round((p / total) * 100) },
    { name: 'Kapha', pct: Math.round((k / total) * 100) },
  ];
  doshas.sort((a, b) => b.pct - a.pct);
  if (doshas[0].pct === doshas[1].pct && doshas[1].pct === doshas[2].pct) return 'Sama';
  return doshas[0].pct - doshas[1].pct <= 15
    ? `${doshas[0].name}-${doshas[1].name}`
    : doshas[0].name;
};

// ── Main Component ────────────────────────────────────────
const ANALYSIS_MSGS = [
  { en: 'Reading your elemental blueprint...', hi: 'आपका तत्व प्रारूप पढ़ा जा रहा है...' },
  { en: 'Calculating dosha composition...', hi: 'दोष संरचना की गणना हो रही है...' },
  { en: 'Mapping your Prakriti pattern...', hi: 'प्रकृति रेखाचित्र बनाया जा रहा है...' },
  { en: 'Preparing your personal report...', hi: 'व्यक्तिगत रिपोर्ट तैयार हो रही है...' },
];
type Phase = 'steps' | 'location' | 'wake-select' | 'prakriti-intro' | 'quiz' | 'analysis' | 'result' | 'plan' | 'pledge';

const PRAKRITI_INTRO: Record<string, string> = {
  en: "Before we discover your Prakriti, let me tell you something ancient and profound. Five thousand years ago, the sages of India observed that every human being is a unique blend of five elements — Earth, Water, Fire, Air and Space. These elements combine into three fundamental forces: Vata, the principle of movement; Pitta, the principle of transformation; and Kapha, the principle of stability. Together, they form your Prakriti — your individual constitutional blueprint. It governs how you think, feel, digest, sleep, and respond to the world. Knowing your Prakriti is the foundation of everything in Ayurveda. Let us find yours now.",
  hi: "आपकी प्रकृति जानने से पहले, एक प्राचीन और गहरी बात सुनें। पाँच हज़ार साल पहले, भारत के ऋषियों ने देखा कि हर इंसान पाँच तत्वों का अनूठा मिश्रण है — पृथ्वी, जल, अग्नि, वायु और आकाश। ये तत्व मिलकर तीन मूल शक्तियाँ बनाते हैं: वात — गति का सिद्धांत, पित्त — परिवर्तन का सिद्धांत, और कफ — स्थिरता का सिद्धांत। मिलकर ये आपकी प्रकृति बनाते हैं — आपका व्यक्तिगत संवैधानिक खाका। यह तय करता है कि आप कैसे सोचते, महसूस करते, पचाते, सोते और दुनिया को कैसे जवाब देते हैं। आयुर्वेद में सब कुछ इसी नींव पर खड़ा है। अब चलते हैं — आपकी प्रकृति खोजते हैं।",
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('en');
  const [phase, setPhase] = useState<Phase>('steps');
  const [stepIdx, setStepIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [textVal, setTextVal] = useState('');
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizMultiSel, setQuizMultiSel] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const dobMonthRef = useRef<import('react-native').TextInput>(null);
  const dobYearRef = useRef<import('react-native').TextInput>(null);
  const [prakriti, setPrakriti] = useState('');
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const analysisAnim = useRef(new Animated.Value(0)).current;
  const [analysisStep, setAnalysisStep] = useState(0);
  const [streakDays, setStreakDays] = useState<7 | 21 | 30 | 90>(21);
  const [startTomorrow, setStartTomorrow] = useState(true);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [wakeSelectionMission, setWakeSelectionMission] = useState<WakeMission | null>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // GPS / location state
  const [locationProfile, setLocationProfile] = useState<LocationProfile | null>(null);
  const [brahmaMuhurta, setBrahmaMuhurta] = useState<BrahmaMuhurtaResult | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSkipped, setLocationSkipped] = useState(false);

  useEffect(() => {
    store.get(KEYS.language).then(l => { if (l) setLang(l); });
  }, []);

  const fadeSwitch = useCallback((cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const speak = useCallback((text: string) => {
    // Cancel any pending debounced speak
    if (speakTimer.current) { clearTimeout(speakTimer.current); speakTimer.current = null; }
    stopBodhi();
    setSpeaking(false);
    // Debounce: only fire Gemini Live if the user stays on this question for 350ms
    // (prevents simultaneous connections when navigating quickly)
    speakTimer.current = setTimeout(() => {
      speakTimer.current = null;
      setSpeaking(true);
      Promise.resolve(speakBodhi(text)).then(() => setSpeaking(false)).catch(() => setSpeaking(false));
    }, 350);
  }, []);

  // Cancel speech on unmount
  useEffect(() => () => { if (speakTimer.current) clearTimeout(speakTimer.current); stopBodhi(); }, []);

  useEffect(() => {
    if (lang) speak(BODHI_INTRO[lang] ?? BODHI_INTRO.en);
  }, [lang]);

  useEffect(() => {
    if (phase !== 'steps') return;
    const s = getSteps(lang)[stepIdx];
    if (s) speak(s.q);
  }, [stepIdx, phase, lang]);

  useEffect(() => {
    if (phase === 'quiz') { setQuizMultiSel([]); speak(getQuiz(lang)[quizIdx].q); }
  }, [quizIdx, phase, lang]);

  useEffect(() => {
    if (phase !== 'analysis') return;
    analysisAnim.setValue(0);
    setAnalysisStep(0);
    let step = 0;
    const iv = setInterval(() => { step += 1; if (step < 4) setAnalysisStep(step); else clearInterval(iv); }, 850);
    Animated.timing(analysisAnim, { toValue: 1, duration: 3400, useNativeDriver: false }).start();
    const t = setTimeout(() => fadeSwitch(() => setPhase('result')), 3700);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [phase]);

  const steps = getSteps(lang);
  const quiz = getQuiz(lang);
  const totalSteps = steps.length + quiz.length;
  const progressPct = phase === 'steps'
    ? (stepIdx / totalSteps) * 100
    : phase === 'quiz' ? ((steps.length + quizIdx) / totalSteps) * 100
      : 100;
  const currentStep = steps[stepIdx];

  const commitStep = useCallback((value: string | string[]) => {
    const s = steps[stepIdx];
    setResponses(r => ({ ...r, [s.id]: value }));
    if (stepIdx < steps.length - 1) {
      fadeSwitch(() => { setStepIdx(i => i + 1); setMultiSel([]); setTextVal(''); });
    } else {
      speak('Perfect. Now let me calculate your exact Brahma Muhurta from your location...');
      fadeSwitch(() => setPhase('location'));
    }
  }, [stepIdx, steps, lang, fadeSwitch]);

  const handleNextQuizQuestion = () => {
    const q = quiz[quizIdx];
    const selected = q.answers.filter(a => quizMultiSel.includes(a.id));
    if (!selected.length) return;
    const newAnswers = { ...answers, [q.id]: selected };
    setAnswers(newAnswers);
    if (quizIdx < quiz.length - 1) {
      fadeSwitch(() => setQuizIdx(i => i + 1));
    } else {
      const result = computePrakritiFromAnswers(newAnswers);
      setPrakriti(result);
      const userName = (responses['name'] as string) || '';
      const primary = result.split('-')[0];
      const dInfo = DOSHA_INFO[primary];
      let vtot = 0, ptot = 0, ktot = 0;
      Object.values(newAnswers).forEach(arr => arr.forEach(a => { vtot += (a.v || 0); ptot += (a.p || 0); ktot += (a.k || 0); }));
      const grand = vtot + ptot + ktot || 1;
      const vPct = Math.round((vtot / grand) * 100);
      const pPct = Math.round((ptot / grand) * 100);
      const kPct = Math.round((ktot / grand) * 100);
      const scores = [['Vata', vPct], ['Pitta', pPct], ['Kapha', kPct]] as [string, number][];
      scores.sort((a, b) => b[1] - a[1]);
      const secondaryName = scores[1][0]; const secondaryPct = scores[1][1];
      if (dInfo) Promise.resolve(speak(dInfo.bodhiSpeech(userName, scores[0][1], secondaryName, secondaryPct))).catch(() => setSpeaking(false));
      fadeSwitch(() => setPhase('analysis'));
    }
  };

  const saveAndEnter = async () => {
    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      const name = (responses['name'] as string) || '';
      const mission = wakeSelectionMission ?? WAKE_MISSIONS[1];
      const wh = mission.wakeHour;
      const wm = mission.wakeMin;

      if (uid) {
        await setDoc(doc(db, 'users', uid), {
          name,
          gender: responses['gender'] ?? '',
          occupation: responses['occupation'] ?? '',
          intentions: responses['intentions'] ?? [],
          lifeAreas: responses['lifeAreas'] ?? [],
          painPoints: responses['painPoints'] ?? [],
          availableMinutes: responses['availableMinutes'] ?? '15',
          dob: responses['dob'] ?? '',
          prakriti, lang,
          wakeProfile: {
            naturalWake: responses['wakeTimeNatural'] ?? '',
            morningStruggle: responses['morningStruggle'] ?? '',
            wakeTime: `${wh}:${String(wm).padStart(2, '0')}`,
            wakeMissionId: mission.id,
          },
          onboardingComplete: true,
          onboardedAt: serverTimestamp(),
        }, { merge: true });
      }

      // Pre-set the wake alarm from the user's chosen target time
      if (!isNaN(wh) && !isNaN(wm)) {
        const currentAlarm = await store.getJSON<AlarmSettings>(KEYS.alarmSettings) ?? DEFAULT_ALARM_SETTINGS;
        const updatedAlarm: AlarmSettings = {
          ...currentAlarm,
          wakeAlarm: { enabled: true, hour: wh, minute: wm },
        };
        await store.setJSON(KEYS.alarmSettings, updatedAlarm);
        scheduleNativeAlarm(wh, wm).catch(() => { });
      }

      await store.setJSON(KEYS.dosha, { prakritiAssessment: { prakriti: { primary: prakriti } } });
      await store.setJSON(KEYS.auth, { name, email: auth.currentUser?.email ?? '' });
      // Save GPS location profile if available
      if (locationProfile) {
        await store.setJSON(KEYS.location, locationProfile);
      }
      const _localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const _tomorrow = new Date(); _tomorrow.setDate(_tomorrow.getDate() + 1);
      const pledgeStart = startTomorrow ? _localDate(_tomorrow) : _localDate(new Date());
      const pledgePayload: PledgeData = { prakriti, startDate: pledgeStart, duration: streakDays, signedAt: Date.now(), userName: name, wakeHour: wh, wakeMin: wm, missionId: mission.id };
      await store.setJSON(KEYS.pledge, pledgePayload);
      const pAlarm: AlarmSettings = { ...(await store.getJSON<AlarmSettings>(KEYS.alarmSettings) ?? DEFAULT_ALARM_SETTINGS), wakeAlarm: { enabled: true, hour: wh, minute: wm } };
      await store.setJSON(KEYS.alarmSettings, pAlarm);
      scheduleNativeAlarm(wh, wm).catch(() => { });
      router.replace('/(tabs)');
    } catch { setSaving(false); }
  };

  const dobString = [dobDay, dobMonth, dobYear].filter(Boolean).join('/');
  useEffect(() => { if (currentStep?.id === 'dob') setTextVal(dobString); }, [dobDay, dobMonth, dobYear]);

  const isHi = lang === 'hi' || lang === 'sa';

  const quizPhaseLabel = quizIdx < 10 ? (isHi ? 'काया' : 'BODY')
    : quizIdx < 17 ? (isHi ? 'मन' : 'MIND') : (isHi ? 'भावना' : 'EMOTIONS');
  const PHASE_BADGE = phase === 'steps' ? (isHi ? 'व्यक्तिगत' : 'PERSONAL')
    : phase === 'quiz' ? quizPhaseLabel
      : (isHi ? 'पूर्ण' : 'COMPLETE');

  const canContinueStep = currentStep
    ? currentStep.id === 'dob' ? true
      : currentStep.type === 'text' ? textVal.trim().length > 0
        : currentStep.type === 'multi' ? multiSel.length > 0
          : true
    : false;

  const handleContinueStep = () => {
    if (!currentStep) return;
    if (currentStep.type === 'text') { if (textVal.trim()) commitStep(textVal.trim()); }
    else if (currentStep.type === 'multi') { if (multiSel.length) commitStep(multiSel); }
    else if (currentStep.id === 'dob') commitStep(textVal.trim() || 'skip');
    else commitStep('');
  };

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground source={{ uri: BG }} style={StyleSheet.absoluteFillObject} imageStyle={{ opacity: 0.14, resizeMode: 'cover' }} />
      <LinearGradient
        colors={['rgba(7,22,62,0.97)', 'rgba(4,13,42,0.99)', 'rgba(2,7,22,1)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Thin gold progress bar — absolute top */}
      <View style={styles.progressTrackWrap}>
        <Animated.View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%` }]} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

          {/* ── LIFESTYLE STEPS ── */}
          {phase === 'steps' && currentStep && (
            <View style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                {/* Badge + counter row */}
                <View style={styles.topRow}>
                  <View style={styles.phaseBadge}><Text style={styles.phaseBadgeTxt}>{PHASE_BADGE}</Text></View>
                  <Text style={styles.stepCounter}>{stepIdx + 1} / {totalSteps}</Text>
                </View>

                {/* Tap to hear */}
                <TouchableOpacity onPress={() => speak(currentStep.q)} style={styles.tapToHear} activeOpacity={0.75}>
                  <Text style={styles.micIcon}>🎙</Text>
                  <Text style={styles.tapToHearTxt}>{speaking ? '● Bodhi speaking...' : 'Tap to hear'}</Text>
                </TouchableOpacity>

                {/* Question */}
                <Text style={styles.stepQ}>{currentStep.q}</Text>
                {currentStep.sub && <Text style={styles.stepSub}>{currentStep.sub}</Text>}

                {/* Text input — name */}
                {currentStep.type === 'text' && currentStep.id !== 'dob' && (
                  <View style={styles.inputWrap}>
                    <TextInput style={styles.input} value={textVal} onChangeText={setTextVal}
                      placeholder={currentStep.placeholder ?? (isHi ? 'यहाँ लिखें...' : 'Type here...')}
                      placeholderTextColor='rgba(255,255,255,0.3)'
                      autoCapitalize="words" returnKeyType="done"
                      onSubmitEditing={() => { if (textVal.trim()) commitStep(textVal.trim()); }}
                      autoFocus />
                  </View>
                )}
                {/* DOB split input */}
                {currentStep.id === 'dob' && (
                  <View style={styles.dobRow}>
                    <View style={styles.dobField}>
                      <Text style={styles.dobLabel}>{isHi ? 'दिन' : 'Day'}</Text>
                      <TextInput style={styles.dobInput} value={dobDay} onChangeText={v => { const d = v.replace(/\D/g, '').slice(0, 2); setDobDay(d); if (d.length === 2) dobMonthRef.current?.focus(); }}
                        placeholder="DD" placeholderTextColor='rgba(255,255,255,0.25)' keyboardType="numeric" maxLength={2} />
                    </View>
                    <Text style={styles.dobSep}>/</Text>
                    <View style={styles.dobField}>
                      <Text style={styles.dobLabel}>{isHi ? 'महीना' : 'Month'}</Text>
                      <TextInput ref={dobMonthRef} style={styles.dobInput} value={dobMonth} onChangeText={v => { const m = v.replace(/\D/g, '').slice(0, 2); setDobMonth(m); if (m.length === 2) dobYearRef.current?.focus(); }}
                        placeholder="MM" placeholderTextColor='rgba(255,255,255,0.25)' keyboardType="numeric" maxLength={2} />
                    </View>
                    <Text style={styles.dobSep}>/</Text>
                    <View style={[styles.dobField, { flex: 1.6 }]}>
                      <Text style={styles.dobLabel}>{isHi ? 'वर्ष' : 'Year'}</Text>
                      <TextInput ref={dobYearRef} style={styles.dobInput} value={dobYear} onChangeText={v => setDobYear(v.replace(/\D/g, '').slice(0, 4))}
                        placeholder="YYYY" placeholderTextColor='rgba(255,255,255,0.25)' keyboardType="numeric" maxLength={4} returnKeyType="done"
                        onSubmitEditing={() => commitStep(dobString || 'skip')} />
                    </View>
                  </View>
                )}

                {/* Choice cards */}
                {currentStep.type === 'choice' && currentStep.options?.map(opt => (
                  <TouchableOpacity key={opt.id} onPress={() => { setTimeout(() => commitStep(opt.id), 220); }}
                    style={[styles.optCard, responses[currentStep.id] === opt.id && styles.optCardActive]} activeOpacity={0.78}>
                    <Text style={[styles.optLabel, { flex: 1 }]}>{opt.label}</Text>
                    {responses[currentStep.id] === opt.id
                      ? <View style={styles.optCheckCircle}><Text style={styles.optCheckTxt}>✓</Text></View>
                      : <Text style={styles.optArrow}>›</Text>}
                  </TouchableOpacity>
                ))}

                {/* Multi-select full-width pills — Calm style */}
                {currentStep.type === 'multi' && (
                  <View>
                    {currentStep.options?.map(opt => {
                      const sel = multiSel.includes(opt.id);
                      return (
                        <TouchableOpacity key={opt.id}
                          onPress={() => setMultiSel(s => s.includes(opt.id) ? s.filter(x => x !== opt.id) : [...s, opt.id])}
                          style={[styles.optCard, sel && styles.optCardActive]} activeOpacity={0.78}>
                          <Text style={[styles.optLabel, { flex: 1 }]}>{opt.label}</Text>
                          {sel
                            ? <View style={styles.optCheckCircle}><Text style={styles.optCheckTxt}>✓</Text></View>
                            : <Text style={styles.optArrow}>›</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <View style={{ height: 100 }} />
              </ScrollView>

              {/* Fixed bottom bar */}
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  onPress={() => stepIdx > 0 ? fadeSwitch(() => { setStepIdx(i => i - 1); setMultiSel([]); setTextVal(''); }) : undefined}
                  style={[styles.backBarBtn, stepIdx === 0 && { opacity: 0.3 }]} activeOpacity={0.75}>
                  <Text style={styles.backBarTxt}>‹ {isHi ? 'वापस' : 'Back'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleContinueStep}
                  disabled={!canContinueStep}
                  style={[styles.continueWrap, !canContinueStep && { opacity: 0.35 }]} activeOpacity={0.85}>
                  <LinearGradient colors={['#D4A840', '#F5C842']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.continueBtn}>
                    <Text style={styles.continueTxt}>{isHi ? 'आगे' : 'Continue'} ›</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── PRAKRITI INTRO ── */}
          {phase === 'prakriti-intro' && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 52, marginBottom: 18 }}>🌿</Text>
              <Text style={{ fontSize: 11, fontWeight: '900', color: Colors.gold, letterSpacing: 2.5, marginBottom: 14, textAlign: 'center' }}>
                {isHi ? 'प्रकृति परीक्षण' : 'PRAKRITI ASSESSMENT'}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center', lineHeight: 28, marginBottom: 12 }}>
                {isHi ? 'आपकी प्राकृतिक संरचना जानते हैं' : 'Discovering Your Natural Constitution'}
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
                {isHi
                  ? 'पाँच तत्व — पृथ्वी, जल, अग्नि, वायु, आकाश — आपस में मिलकर तीन दोष बनाते हैं।'
                  : 'Five elements — Earth, Water, Fire, Air & Space — combine into three fundamental forces.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28, marginTop: 4 }}>
                {[{ e: '🌬️', n: 'Vata', c: '#a78bfa' }, { e: '🔥', n: 'Pitta', c: '#f97316' }, { e: '🌿', n: 'Kapha', c: '#10b981' }].map(d => (
                  <View key={d.n} style={{ alignItems: 'center', backgroundColor: d.c + '18', borderWidth: 1, borderColor: d.c + '40', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 22 }}>{d.e}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: d.c, marginTop: 4 }}>{d.n}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20, marginBottom: 32 }}>
                {isHi
                  ? 'Bodhi आपसे 10 सवाल पूछेगा। जो सबसे सही लगे वो चुनें — कोई सही या गलत जवाब नहीं।'
                  : 'Bodhi will ask 10 questions. Choose what feels most naturally true — there are no right or wrong answers.'}
              </Text>
              <TouchableOpacity
                onPress={() => { stopBodhi(); fadeSwitch(() => { setPhase('quiz'); setQuizMultiSel([]); }); }}
                style={{ width: '100%', borderRadius: Radius.full, overflow: 'hidden' }} activeOpacity={0.85}>
                <LinearGradient colors={['#D4A840', '#F5C842']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 15, alignItems: 'center' }}>
                  <Text style={{ color: '#0A0A0F', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 }}>
                    {isHi ? 'परीक्षण शुरू करें ›' : 'Begin Assessment ›'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PRAKRITI QUIZ ── */}
          {phase === 'quiz' && (
            <View style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.topRow}>
                  <View style={styles.phaseBadge}><Text style={styles.phaseBadgeTxt}>{PHASE_BADGE}</Text></View>
                  <Text style={styles.stepCounter}>{steps.length + quizIdx + 1} / {totalSteps} · {quizPhaseLabel}</Text>
                </View>

                <TouchableOpacity onPress={() => speak(quiz[quizIdx].q)} style={styles.tapToHear} activeOpacity={0.75}>
                  <Text style={styles.micIcon}>🎙</Text>
                  <Text style={styles.tapToHearTxt}>{speaking ? '● Bodhi speaking...' : (isHi ? 'सुनने के लिए tap करो' : 'Tap to hear')}</Text>
                </TouchableOpacity>

                <Text style={styles.stepQ}>{quiz[quizIdx].emoji}  {quiz[quizIdx].q}</Text>
                {quiz[quizIdx].sub && <Text style={styles.stepSub}>{quiz[quizIdx].sub}</Text>}

                <Text style={styles.quizHint}>{isHi ? 'एक या अधिक चुनें' : 'Select one or more that apply'}</Text>
                {quiz[quizIdx].answers.map(ans => {
                  const sel = quizMultiSel.includes(ans.id);
                  return (
                    <TouchableOpacity key={ans.id}
                      onPress={() => setQuizMultiSel(s => s.includes(ans.id) ? s.filter(x => x !== ans.id) : [...s, ans.id])}
                      activeOpacity={0.78} style={[styles.optCard, sel && styles.optCardActive]}>
                      <Text style={[styles.optLabel, { flex: 1, flexWrap: 'wrap' }]}>{ans.label}</Text>
                      {sel ? <View style={styles.optCheckCircle}><Text style={styles.optCheckTxt}>✓</Text></View>
                        : <Text style={styles.optArrow}>›</Text>}
                    </TouchableOpacity>
                  );
                })}
                <View style={{ height: 100 }} />
              </ScrollView>

              <View style={styles.bottomBar}>
                <TouchableOpacity
                  onPress={() => quizIdx > 0 ? fadeSwitch(() => setQuizIdx(i => i - 1)) : undefined}
                  style={[styles.backBarBtn, quizIdx === 0 && { opacity: 0.3 }]} activeOpacity={0.75}>
                  <Text style={styles.backBarTxt}>‹ {isHi ? 'वापस' : 'Back'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleNextQuizQuestion}
                  disabled={quizMultiSel.length === 0}
                  style={[styles.continueWrap, quizMultiSel.length === 0 && { opacity: 0.35 }]} activeOpacity={0.85}>
                  <LinearGradient colors={['#D4A840', '#F5C842']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.continueBtn}>
                    <Text style={styles.continueTxt}>{isHi ? 'आगे' : 'Next'} ›</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── ANALYSIS ── */}
          {phase === 'analysis' && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
              <View style={{ flexDirection: 'row', gap: 20, marginBottom: 40 }}>
                {(['#a78bfa', '#f97316', '#10b981'] as string[]).map((c, i) => (
                  <Animated.View key={i} style={{
                    width: 68, height: 68, borderRadius: 34,
                    backgroundColor: c + '25', borderWidth: 1.5, borderColor: c + '60',
                    alignItems: 'center', justifyContent: 'center',
                    opacity: analysisAnim.interpolate({
                      inputRange: [0, 0.33, 0.66, 1],
                      outputRange: i === 0 ? [0.4, 1, 0.4, 0.7] : i === 1 ? [0.4, 0.4, 1, 0.4] : [1, 0.4, 0.7, 1],
                    }),
                  }}>
                    <Text style={{ fontSize: 30 }}>{['🌬️', '🔥', '🌿'][i]}</Text>
                  </Animated.View>
                ))}
              </View>
              <Text style={{ fontSize: 11, fontWeight: '900', color: Colors.gold, letterSpacing: 2.5, marginBottom: 14, textAlign: 'center' }}>
                {isHi ? 'विश्लेषण हो रहा है' : 'ANALYSING YOUR PRAKRITI'}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center', lineHeight: 26, marginBottom: 32, minHeight: 52 }}>
                {isHi ? ANALYSIS_MSGS[analysisStep].hi : ANALYSIS_MSGS[analysisStep].en}
              </Text>
              <View style={{ width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
                <Animated.View style={{
                  height: '100%', borderRadius: 2, backgroundColor: Colors.gold,
                  width: analysisAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) as any,
                }} />
              </View>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20 }}>
                {isHi ? 'आयुर्वेदिक ज्ञान से आपके उत्तर मिलाए जा रहे हैं' : 'Cross-referencing your answers with ancient Ayurvedic wisdom'}
              </Text>
            </View>
          )}

          {/* ── RESULT ── */}
          {phase === 'result' && (() => {
            let v = 0, p = 0, k = 0;
            Object.values(answers).forEach(arr => arr.forEach(a => { v += a.v; p += a.p; k += a.k; }));
            const total = v + p + k || 1;
            const primary = prakriti.split('-')[0];
            const dInfo = DOSHA_INFO[primary] ?? DOSHA_INFO.Vata;
            const userName = (responses['name'] as string) || '';
            const scores = [['Vata', '🌬️', '#a78bfa', v], ['Pitta', '🔥', '#f97316', p], ['Kapha', '🌿', '#10b981', k]] as [string, string, string, number][];
            scores.sort((a, b) => b[3] - a[3]);
            const secName = scores[1][0]; const secPct = Math.round((scores[1][3] / total) * 100);
            return (
              <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>

                {/* Header badge + speak */}
                <View style={styles.topRow}>
                  <View style={[styles.phaseBadge, { backgroundColor: dInfo.color + '30', borderColor: dInfo.color + '60' }]}>
                    <Text style={[styles.phaseBadgeTxt, { color: dInfo.color }]}>{isHi ? 'पूर्ण' : 'COMPLETE'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => speak(dInfo.bodhiSpeech(userName, Math.round((scores[0][3] / total) * 100), secName, secPct))} style={styles.speakCircle} activeOpacity={0.75}>
                    <Text style={{ fontSize: 16 }}>🔊</Text>
                  </TouchableOpacity>
                </View>

                {/* Hero card */}
                <LinearGradient colors={[dInfo.color + '28', dInfo.color + '08']} style={[styles.resultCard, { borderColor: dInfo.color + '45' }]}>
                  <Text style={styles.resultEmoji}>{dInfo.emoji}</Text>
                  <Text style={[styles.resultTitle, { color: dInfo.color }]}>{dInfo.title}</Text>
                  <Text style={styles.resultDesc}>{dInfo.desc}</Text>
                  <View style={[styles.qualitiesPill, { backgroundColor: dInfo.color + '18', borderColor: dInfo.color + '35' }]}>
                    <Text style={[styles.qualitiesTxt, { color: dInfo.color }]}>{dInfo.qualities}</Text>
                  </View>
                </LinearGradient>

                {/* Dosha composition bars */}
                <View style={styles.scoreSection}>
                  <Text style={styles.scoreTitle}>{isHi ? 'आपकी दोष रचना' : 'Your Dosha Composition'}</Text>
                  {scores.map(([d, e, c, val]) => (
                    <View key={d as string} style={styles.scoreRow}>
                      <Text style={styles.scoreEmoji}>{e}</Text>
                      <Text style={styles.scoreName}>{d}</Text>
                      <View style={styles.scoreTrack}>
                        <View style={[styles.scoreBar, { width: `${Math.round(((val as number) / total) * 100)}%` as `${number}%`, backgroundColor: c as string }]} />
                      </View>
                      <Text style={[styles.scorePct, { color: c as string }]}>{Math.round(((val as number) / total) * 100)}%</Text>
                    </View>
                  ))}
                </View>

                {/* Secondary note */}
                {secPct >= 25 && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 }}>{isHi ? 'द्वितीयक प्रकृति' : 'SECONDARY NATURE'}</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 20 }}>
                      {isHi
                        ? `${secName} ${secPct}% पर दूसरे स्थान पर है — यह आपकी सोच और शरीर दोनों को प्रभावित करता है।`
                        : `${secName} at ${secPct}% is your secondary influence — it shapes your thinking, digestion and emotional responses alongside your primary dosha.`}
                    </Text>
                  </View>
                )}

                {/* Personality */}
                <View style={[styles.detailCard, { borderColor: dInfo.color + '30' }]}>
                  <Text style={[styles.detailHead, { color: dInfo.color }]}>✦ {isHi ? 'व्यक्तित्व' : 'Personality'}</Text>
                  <Text style={styles.detailBody}>{dInfo.personality}</Text>
                </View>

                {/* Daily Life */}
                <View style={[styles.detailCard, { borderColor: dInfo.color + '30' }]}>
                  <Text style={[styles.detailHead, { color: dInfo.color }]}>☀ {isHi ? 'दैनिक जीवन' : 'Daily Life'}</Text>
                  <Text style={styles.detailBody}>{dInfo.dailyLife}</Text>
                </View>

                {/* Diet tips */}
                <View style={[styles.detailCard, { borderColor: dInfo.color + '30' }]}>
                  <Text style={[styles.detailHead, { color: dInfo.color }]}>🍃 {isHi ? 'आहार सुझाव' : 'Diet Tips'}</Text>
                  {dInfo.dietTips.map((t, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <Text style={{ color: dInfo.color, fontSize: 13, marginTop: 1 }}>›</Text>
                      <Text style={[styles.detailBody, { flex: 1, marginTop: 0 }]}>{t}</Text>
                    </View>
                  ))}
                </View>

                {/* Dinacharya */}
                <View style={[styles.detailCard, { borderColor: dInfo.color + '30' }]}>
                  <Text style={[styles.detailHead, { color: dInfo.color }]}>🌅 {isHi ? 'दिनचर्या' : 'Dinacharya'}</Text>
                  {dInfo.dinacharya.map((t, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <Text style={{ color: dInfo.color, fontSize: 13, marginTop: 1 }}>›</Text>
                      <Text style={[styles.detailBody, { flex: 1, marginTop: 0 }]}>{t}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity onPress={() => fadeSwitch(() => setPhase('plan'))} activeOpacity={0.85} style={styles.beginWrap}>
                  <LinearGradient colors={[dInfo.color, dInfo.color + 'cc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.beginBtn}>
                    <Text style={styles.beginTxt}>{isHi ? 'मेरी दिनचर्या देखें ✦' : 'See My Daily Plan ✦'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            );
          })()}

          {/* ── LOCATION PERMISSION ── */}
          {phase === 'location' && (() => {
            const primary = prakriti.split('-')[0] || 'Vata';
            const dInfo = DOSHA_INFO[primary] ?? DOSHA_INFO.Vata;

            const handleAllowLocation = async () => {
              setLocationLoading(true);
              try {
                const coords = await requestLocation();
                if (coords) {
                  const profile = buildLocationProfile(coords.lat, coords.lon);
                  const bm = getBrahmaMuhurtaResult(coords.lat, coords.lon);
                  setLocationProfile(profile);
                  setBrahmaMuhurta(bm);
                  // Speak Bodhi response
                  const month = new Date().getMonth() + 1;
                  const season = getAyurvedicSeason(coords.lat, month);
                  speak(`Perfect. I can see your location. Your sunrise today is at ${bm.sunriseHour}:${String(bm.sunriseMin).padStart(2, '0')}. Your Brahma Muhurta — the sacred window 96 minutes before sunrise — is at ${bm.wakeHour}:${String(bm.wakeMin).padStart(2, '0')}. This is when Vata is pure and the mind is clearest. I have set your wake alarm to this time. Your climate is ${CLIMATE_LABELS[profile.climateZone]}. We are in ${SEASON_LABELS[season].label} season. Your entire routine is now aligned with your location and your Prakriti.`);
                  // Schedule Brahma Muhurta alarm immediately
                  scheduleBrahmaMuhurtaAlarm(coords.lat, coords.lon).catch(() => { });
                } else {
                  setLocationSkipped(true);
                  speak('No problem. You can always adjust your wake time manually. Your routine is built from your Prakriti.');
                }
              } catch {
                setLocationSkipped(true);
              }
              setLocationLoading(false);
            };

            const seasonKey = (() => {
              const m = new Date().getMonth() + 1;
              if (locationProfile) return getAyurvedicSeason(locationProfile.lat, m);
              return null;
            })();

            return (
              <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.topRow}>
                  <View style={[styles.phaseBadge, { backgroundColor: dInfo.color + '30', borderColor: dInfo.color + '60' }]}>
                    <Text style={[styles.phaseBadgeTxt, { color: dInfo.color }]}>NATURE ALIGNMENT</Text>
                  </View>
                </View>

                {/* Hero card */}
                <View style={{
                  marginTop: 12, borderRadius: 22, overflow: 'hidden',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                }}>
                  <LinearGradient
                    colors={['rgba(139,92,246,0.18)', 'rgba(59,130,246,0.12)', 'rgba(0,0,0,0)']}
                    style={{ padding: 24, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 52, marginBottom: 10 }}>🌅</Text>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 6 }}>
                      {isHi ? 'प्रकृति से जोड़ें' : 'Align With Nature'}
                    </Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 21 }}>
                      {isHi
                        ? 'Ayu Intel आपकी GPS से आपका स्थानीय सूर्योदय, मौसम और जलवायु जानता है — ताकि आपकी दिनचर्या और जागने का समय पूरी तरह प्रकृति के अनुरूप हो।'
                        : 'Ayu Intel uses your location to understand your local sunrise, climate, and seasons — so your wake time and daily routine are perfectly aligned with nature, just as Ayurveda intended.'}
                    </Text>
                  </LinearGradient>
                </View>

                {/* Result shown after GPS granted */}
                {brahmaMuhurta && locationProfile ? (
                  <View style={{ marginTop: 16, gap: 8 }}>
                    {/* Brahma Muhurta card */}
                    <View style={{
                      backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 18,
                      borderWidth: 1, borderColor: 'rgba(251,191,36,0.30)',
                      padding: 18,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#F5C842', letterSpacing: 1.5, marginBottom: 6 }}>☀️ BRAHMA MUHURTA — YOUR WAKE TIME</Text>
                      <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 }}>
                        {brahmaMuhurta.wakeHour === 0 ? 12 : brahmaMuhurta.wakeHour > 12 ? brahmaMuhurta.wakeHour - 12 : brahmaMuhurta.wakeHour}:{String(brahmaMuhurta.wakeMin).padStart(2, '0')} {brahmaMuhurta.wakeHour < 12 ? 'AM' : 'PM'}
                      </Text>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)' }}>
                        🌄 Sunrise: {brahmaMuhurta.sunriseHour}:{String(brahmaMuhurta.sunriseMin).padStart(2, '0')} AM · 96 min before
                      </Text>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                        🥗 Dinner by: {brahmaMuhurta.dinnerDeadlineHour > 12 ? brahmaMuhurta.dinnerDeadlineHour - 12 : brahmaMuhurta.dinnerDeadlineHour}:{String(brahmaMuhurta.dinnerDeadlineMin).padStart(2, '0')} {brahmaMuhurta.dinnerDeadlineHour < 12 ? 'AM' : 'PM'}  ·  🌙 Sleep by: {brahmaMuhurta.sleepHour > 12 ? brahmaMuhurta.sleepHour - 12 : brahmaMuhurta.sleepHour}:{String(brahmaMuhurta.sleepMin).padStart(2, '0')} {brahmaMuhurta.sleepHour < 12 ? 'AM' : 'PM'}
                      </Text>
                    </View>

                    {/* Climate + Season */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{
                        flex: 1, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 14,
                        borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', padding: 14,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#10b981', letterSpacing: 1.2, marginBottom: 4 }}>🌍 CLIMATE</Text>
                        <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>
                          {CLIMATE_LABELS[locationProfile.climateZone].split('·')[0].trim()}
                        </Text>
                        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>
                          {CLIMATE_LABELS[locationProfile.climateZone].split('·')[1]?.trim()}
                        </Text>
                      </View>
                      {seasonKey && (
                        <View style={{
                          flex: 1, backgroundColor: 'rgba(251,146,60,0.12)', borderRadius: 14,
                          borderWidth: 1, borderColor: 'rgba(251,146,60,0.25)', padding: 14,
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '900', color: '#fb923c', letterSpacing: 1.2, marginBottom: 4 }}>🍂 SEASON</Text>
                          <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>
                            {SEASON_LABELS[seasonKey].emoji} {SEASON_LABELS[seasonKey].label.split('(')[0].trim()}
                          </Text>
                          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginTop: 2 }} numberOfLines={2}>
                            {SEASON_LABELS[seasonKey].note.split('.')[0]}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* CTA */}
                    <TouchableOpacity
                      onPress={() => fadeSwitch(() => setPhase('wake-select'))}
                      activeOpacity={0.85} style={[styles.beginWrap, { marginTop: 12 }]}
                    >
                      <LinearGradient colors={[dInfo.color, dInfo.color + 'cc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.beginBtn}>
                        <Text style={styles.beginTxt}>{isHi ? 'जागने का समय चुनें ✦' : 'Choose My Wake Time ✦'}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : locationSkipped ? (
                  /* Skipped — just continue */
                  <View style={{ marginTop: 20, gap: 12 }}>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 }}>
                      No problem — your routine is built from your Prakriti. You can always set location anytime from settings.
                    </Text>
                    <TouchableOpacity
                      onPress={() => fadeSwitch(() => setPhase('wake-select'))}
                      activeOpacity={0.85} style={styles.beginWrap}
                    >
                      <LinearGradient colors={[dInfo.color, dInfo.color + 'cc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.beginBtn}>
                        <Text style={styles.beginTxt}>{isHi ? 'जागने का समय चुनें ✦' : 'Choose My Wake Time ✦'}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Pre-grant buttons */
                  <View style={{ marginTop: 20, gap: 12 }}>
                    {/* Why we need it */}
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, gap: 8 }}>
                      {[
                        ['🌄', 'Calculates your exact Brahma Muhurta wake time from today\'s sunrise'],
                        ['🌍', 'Detects your climate zone and Ayurvedic season'],
                        ['🍽️', 'Tailors food recommendations to your local environment'],
                        ['🔒', 'Location is used only on your device — never shared'],
                      ].map(([icon, text]) => (
                        <View key={text} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                          <Text style={{ fontSize: 16 }}>{icon}</Text>
                          <Text style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 18 }}>{text}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Allow button */}
                    <TouchableOpacity
                      onPress={handleAllowLocation}
                      disabled={locationLoading}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#6366f1', '#8b5cf6']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.beginBtn, { borderRadius: 16, paddingVertical: 16 }]}
                      >
                        {locationLoading
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={[styles.beginTxt, { color: '#fff' }]}>📍 {isHi ? 'GPS की अनुमति दें' : 'Allow Location Access'}</Text>
                        }
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Skip */}
                    <TouchableOpacity
                      onPress={() => { setLocationSkipped(true); speak('No problem. Your routine is built from your Prakriti.'); }}
                      style={{ alignItems: 'center', paddingVertical: 12 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)' }}>
                        {isHi ? 'अभी नहीं — बाद में' : 'Skip for now · Set manually'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={{ height: 40 }} />
              </ScrollView>
            );
          })()}

          {/* ── PLAN ── */}
          {phase === 'plan' && (() => {
            const primary = prakriti.split('-')[0] || 'Vata';
            const dInfo = DOSHA_INFO[primary] ?? DOSHA_INFO.Vata;
            const plan = getPrakritiPlan(prakriti);
            const selectedMission = wakeSelectionMission;
            const planActivities = selectedMission
              ? shiftActivitiesToWake(plan.activities, plan.wakeHour * 60 + plan.wakeMin, selectedMission.wakeHour * 60 + selectedMission.wakeMin)
              : plan.activities;
            const displayWakeTime = selectedMission ? selectedMission.time : plan.wakeTime;
            return (
              <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>
                  <View style={styles.topRow}>
                    <View style={[styles.phaseBadge, { backgroundColor: dInfo.color + '30', borderColor: dInfo.color + '60' }]}>
                      <Text style={[styles.phaseBadgeTxt, { color: dInfo.color }]}>{isHi ? 'दिनचर्या' : 'DINACHARYA'}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '800', letterSpacing: 1.5 }}>16 PRACTICES</Text>
                  </View>
                  <Text style={{ fontSize: 21, fontWeight: '900', color: 'rgba(255,255,255,0.95)', lineHeight: 28, marginBottom: 6 }}>
                    {isHi ? 'आपकी व्यक्तिगत दिनचर्या' : `Your ${prakriti} Dinacharya`}
                  </Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginBottom: 10, fontStyle: 'italic' }}>
                    "{plan.morningMantra}"
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: dInfo.color + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12 }}>⏰</Text>
                      <Text style={{ fontSize: 11, color: dInfo.color, fontWeight: '800' }}>{displayWakeTime}</Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', gap: 5, alignItems: 'center', flex: 1 }}>
                      <Text style={{ fontSize: 12 }}>🏃</Text>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', flex: 1 }} numberOfLines={1}>{plan.exerciseLabel}</Text>
                    </View>
                  </View>

                  {planActivities.map((a, i) => (
                    <View key={`${a.habitId}-${i}`} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: dInfo.color + '20', borderRadius: 14, padding: 13, marginBottom: 9, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                      <View style={{ backgroundColor: dInfo.color + '22', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 6, alignItems: 'center', minWidth: 62 }}>
                        <Text style={{ fontSize: 9, color: dInfo.color, fontWeight: '900', letterSpacing: 0.2, textAlign: 'center' }}>{a.time}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <Text style={{ fontSize: 15 }}>{a.emoji}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.9)', flex: 1 }}>{a.name}</Text>
                          {a.duration !== '—' && <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: '700' }}>{a.duration}</Text>}
                        </View>
                        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', lineHeight: 17 }}>{a.note}</Text>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity onPress={() => fadeSwitch(() => setPhase('pledge'))} activeOpacity={0.85} style={[styles.beginWrap, { marginTop: 8 }]}>
                    <LinearGradient colors={[dInfo.color, dInfo.color + 'bb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.beginBtn}>
                      <Text style={styles.beginTxt}>{isHi ? 'प्रतिज्ञा करें ✦' : 'Make My Pledge ✦'}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            );
          })()}

          {/* ── PLEDGE ── */}
          {phase === 'pledge' && (() => {
            const primary = prakriti.split('-')[0] || 'Vata';
            const dInfo = DOSHA_INFO[primary] ?? DOSHA_INFO.Vata;
            const uName = (responses['name'] as string) || 'Sadhaka';
            const plan = getPrakritiPlan(prakriti);
            return (
              <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>
                  <View style={styles.topRow}>
                    <View style={[styles.phaseBadge, { backgroundColor: dInfo.color + '30', borderColor: dInfo.color + '60' }]}>
                      <Text style={[styles.phaseBadgeTxt, { color: dInfo.color }]}>{isHi ? 'प्रतिज्ञा' : 'PLEDGE'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => fadeSwitch(() => setPhase('plan'))} activeOpacity={0.75}>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '700' }}>‹ {isHi ? 'वापस' : 'Plan'}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ alignItems: 'center', marginBottom: 22 }}>
                    <Text style={{ fontSize: 44, marginBottom: 10 }}>🙏</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: 'rgba(255,255,255,0.95)', textAlign: 'center', lineHeight: 30, marginBottom: 8 }}>
                      {isHi ? 'आपकी पवित्र प्रतिज्ञा' : 'Your Sacred Commitment'}
                    </Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 19 }}>
                      {isHi ? 'प्रकृति के प्रति प्रतिज्ञा — अपने सच्चे स्वरूप की सेवा' : 'A pledge to your Prakriti is a pledge to your truest self'}
                    </Text>
                  </View>

                  <View style={{ backgroundColor: dInfo.color + '18', borderWidth: 1, borderColor: dInfo.color + '40', borderRadius: 16, padding: 18, marginBottom: 22 }}>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 24, textAlign: 'center', fontStyle: 'italic' }}>
                      {`"I, ${uName}, commit to following my ${prakriti} Prakriti Dinacharya for the next ${streakDays} days — beginning ${startTomorrow ? 'tomorrow' : 'today'} — in service of my highest health and conscious living."`}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 10, fontWeight: '900', color: Colors.gold, letterSpacing: 2, marginBottom: 12 }}>
                    {isHi ? 'अवधि चुनें' : 'SELECT PLEDGE DURATION'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 9, marginBottom: 18 }}>
                    {([7, 21, 30, 90] as const).map(d => (
                      <TouchableOpacity key={d} onPress={() => setStreakDays(d)} style={{ flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center', backgroundColor: streakDays === d ? dInfo.color : 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: streakDays === d ? dInfo.color : 'rgba(255,255,255,0.1)' }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: streakDays === d ? '#0A0A0F' : 'rgba(255,255,255,0.75)' }}>{d}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: streakDays === d ? '#0A0A0F' : 'rgba(255,255,255,0.3)' }}>{isHi ? 'दिन' : 'DAYS'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    {[false, true].map(tm => (
                      <TouchableOpacity key={String(tm)} onPress={() => setStartTomorrow(tm)} style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 13, backgroundColor: startTomorrow === tm ? dInfo.color + '1A' : 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: startTomorrow === tm ? dInfo.color + '55' : 'rgba(255,255,255,0.1)' }}>
                        <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: dInfo.color, alignItems: 'center', justifyContent: 'center' }}>
                          {startTomorrow === tm && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dInfo.color }} />}
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.78)' }}>{tm ? (isHi ? 'कल से' : 'Start Tomorrow') : (isHi ? 'आज से' : 'Start Today')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Selected wake time summary */}
                  {wakeSelectionMission && (
                    <View style={{ backgroundColor: wakeSelectionMission.color + '14', borderWidth: 1, borderColor: wakeSelectionMission.color + '40', borderRadius: 16, padding: 16, marginBottom: 22, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 32 }}>{wakeSelectionMission.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: wakeSelectionMission.color, fontWeight: '900', letterSpacing: 1.5, marginBottom: 3 }}>YOUR WAKE TIME</Text>
                        <Text style={{ fontSize: 16, color: wakeSelectionMission.color, fontWeight: '900' }}>{wakeSelectionMission.time} — {wakeSelectionMission.name}</Text>
                        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>{wakeSelectionMission.headline}</Text>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity onPress={saveAndEnter} disabled={saving} activeOpacity={0.85} style={styles.beginWrap}>
                    <LinearGradient colors={[dInfo.color, dInfo.color + 'bb']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.beginBtn}>
                      {saving
                        ? <ActivityIndicator color="#0A0A0F" />
                        : <Text style={styles.beginTxt}>{isHi ? 'मेरी यात्रा शुरू ✦' : 'I Pledge & Begin Journey ✦'}</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            );
          })()}

          {/* ── WAKE-SELECT ── */}
          {phase === 'wake-select' && (() => {
            const wakeOptions = getLocationAwareWakeOptions(brahmaMuhurta);
            const hasLocation = !!brahmaMuhurta;
            const selectedOption = wakeOptions.find(m => m.id === selectedMissionId);
            return (
              <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 52 }]} showsVerticalScrollIndicator={false}>

                  {/* Header */}
                  <View style={styles.topRow}>
                    <View style={[styles.phaseBadge, { backgroundColor: '#F5C84220', borderColor: '#F5C84250' }]}>
                      <Text style={[styles.phaseBadgeTxt, { color: Colors.gold }]}>WAKE-UP TIME</Text>
                    </View>
                    <TouchableOpacity onPress={() => fadeSwitch(() => setPhase('location'))} activeOpacity={0.75}>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '700' }}>‹ Back</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={{ fontSize: 26, fontWeight: '900', color: Colors.text, lineHeight: 32, marginBottom: 6 }}>
                    🌙 Your Sacred{'\n'}Wake Time
                  </Text>

                  {hasLocation ? (
                    <View style={{ backgroundColor: 'rgba(245,196,66,0.08)', borderWidth: 1, borderColor: 'rgba(245,196,66,0.25)', borderRadius: 12, padding: 12, marginBottom: 18, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 20 }}>📍</Text>
                      <Text style={{ fontSize: 12, color: Colors.gold, fontWeight: '700', flex: 1, lineHeight: 18 }}>
                        Times calibrated to your location's actual Brahma Muhurta — the most accurate Ayurvedic alignment possible.
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 20, marginBottom: 18, fontStyle: 'italic' }}>
                      Choose the time you can commit to honestly. All three windows begin in the sacred Brahma Muhurta.
                    </Text>
                  )}

                  {wakeOptions.map((m, idx) => {
                    const isSelected = selectedMissionId === m.id;
                    const TIER_BG = m.tier === 'gold' ? 'rgba(245,200,66,0.10)' : m.tier === 'silver' ? 'rgba(167,139,250,0.10)' : 'rgba(16,185,129,0.10)';
                    return (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => { setSelectedMissionId(m.id); setWakeSelectionMission(m); }}
                        activeOpacity={0.82}
                        style={{
                          backgroundColor: isSelected ? TIER_BG : 'rgba(255,255,255,0.04)',
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? m.color : 'rgba(255,255,255,0.10)',
                          borderRadius: 20, padding: 18, marginBottom: 14,
                        }}
                      >
                        {/* Badge row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <View style={{ backgroundColor: m.color + '22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: m.color + '45' }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: m.color, letterSpacing: 1 }}>{m.badge}</Text>
                          </View>
                          {isSelected
                            ? <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: m.color, alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 14, fontWeight: '900', color: '#0A0A0F' }}>✓</Text>
                            </View>
                            : <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
                          }
                        </View>

                        {/* Time + name row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: m.color + '20', borderWidth: 1, borderColor: m.color + '40', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: m.color, marginBottom: 2 }}>{m.name}</Text>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3 }}>{m.headline}</Text>
                          </View>
                          <View style={{ backgroundColor: m.color + '20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: m.color }}>⏰</Text>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: m.color, marginTop: 2 }}>{m.time}</Text>
                          </View>
                        </View>

                        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20, marginBottom: 12 }}>{m.desc}</Text>

                        <View style={{ gap: 6 }}>
                          {m.perks.map((perk, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />
                              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', flex: 1 }}>{perk}</Text>
                            </View>
                          ))}
                        </View>

                        {idx === 0 && (
                          <View style={{ marginTop: 12, backgroundColor: 'rgba(245,196,66,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <Text style={{ fontSize: 14 }}>✦</Text>
                            <Text style={{ fontSize: 11, color: Colors.gold, fontWeight: '700', flex: 1 }}>
                              {hasLocation ? 'Your exact Brahma Muhurta — highest Ayurvedic alignment for your location.' : 'Recommended — Highest Ayurvedic alignment. Brahma Muhurta at its purest.'}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* About Brahma Muhurta */}
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.2, marginBottom: 6 }}>ABOUT BRAHMA MUHURTA</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 21 }}>
                      Brahma Muhurta is the sacred window 96 minutes before sunrise — the most Sattvic, pure and spiritually potent time of the entire day. The mind is naturally still. Prana flows freely. Your practices here carry 10× the benefit.
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => { if (selectedOption) { speak(PRAKRITI_INTRO[lang] ?? PRAKRITI_INTRO.en); fadeSwitch(() => setPhase('prakriti-intro')); } }}
                    disabled={!selectedMissionId}
                    activeOpacity={0.85}
                    style={[styles.beginWrap, !selectedMissionId && { opacity: 0.38 }]}
                  >
                    <LinearGradient
                      colors={selectedOption ? [selectedOption.color, selectedOption.color + 'bb'] : [Colors.gold, Colors.gold + 'bb']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.beginBtn}
                    >
                      <Text style={styles.beginTxt}>
                        {selectedOption ? `Discover My Prakriti ✦` : 'Select Your Wake Time First'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            );
          })()}

        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Progress bar
  progressTrackWrap: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 99 },
  progressFill: { height: '100%', backgroundColor: Colors.gold },

  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 },

  // Top row
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  phaseBadge: { borderWidth: 1, borderColor: 'rgba(245,196,66,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(245,196,66,0.10)' },
  phaseBadgeTxt: { fontSize: 10, fontWeight: '900', color: Colors.gold, letterSpacing: 1.5 },
  stepCounter: { fontSize: Font.sizes.sm, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },

  // Tap to hear
  tapToHear: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, alignSelf: 'flex-start', backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  micIcon: { fontSize: 13 },
  tapToHearTxt: { fontSize: 11, fontWeight: '700', color: '#93c5fd' },

  // Question
  stepQ: { fontSize: 20, fontWeight: '800', color: Colors.text, lineHeight: 28, marginBottom: 6, letterSpacing: -0.2 },
  stepSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 19, marginBottom: 10 },
  quizHint: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600', letterSpacing: 0.4, marginBottom: 8 },

  // Text input (styled like screenshot)
  inputWrap: { position: 'relative', marginBottom: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18, color: Colors.text, fontSize: Font.sizes.base, fontWeight: '600', borderWidth: 1.5, borderColor: Colors.gold + '70' },
  dobRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  dobField: { flex: 1, alignItems: 'center' },
  dobLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  dobInput: { width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12, textAlign: 'center', color: Colors.text, fontSize: Font.sizes.base, fontWeight: '700', borderWidth: 1.5, borderColor: Colors.gold + '60' },
  dobSep: { fontSize: 20, color: Colors.gold, fontWeight: '300', marginBottom: 14 },

  // Choice cards — refined low-radius calm style
  optCard: { backgroundColor: 'rgba(255,255,255,0.055)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 7, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, marginHorizontal: 2 },
  optCardActive: { borderColor: Colors.gold + 'cc', backgroundColor: 'rgba(245,196,66,0.12)', borderWidth: 1.5 },
  optLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  optDesc: { fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 },
  optCheckCircle: { width: 22, height: 22, borderRadius: 6, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  optCheckTxt: { fontSize: 12, fontWeight: '900', color: '#0A0A0F' },
  optArrow: { fontSize: 18, color: 'rgba(255,255,255,0.20)' },

  // Multi-select
  multiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  multiChip: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  multiChipActive: { borderColor: Colors.gold, backgroundColor: 'rgba(245,196,66,0.15)' },
  multiChipTxt: { fontSize: Font.sizes.sm, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },
  multiCheck: { fontSize: 12, color: Colors.gold, fontWeight: '900' },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.lg, paddingBottom: 28, paddingTop: 14, backgroundColor: 'rgba(2,8,26,0.95)' },
  backBarBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  backBarTxt: { color: 'rgba(255,255,255,0.7)', fontSize: Font.sizes.base, fontWeight: '700' },
  continueWrap: { flex: 1.6, borderRadius: 10, overflow: 'hidden' },
  continueBtn: { paddingVertical: 14, alignItems: 'center' },
  continueTxt: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '900' },

  // Speak (result phase)
  speakCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

  // Result
  resultCard: { borderRadius: 20, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg, alignItems: 'center' },
  resultEmoji: { fontSize: 56, marginBottom: 10 },
  resultTitle: { fontSize: 24, fontWeight: '900', marginBottom: 8 },
  resultDesc: { fontSize: Font.sizes.base, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  qualitiesPill: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  qualitiesTxt: { fontSize: Font.sizes.xs, fontWeight: '700', letterSpacing: 0.5 },

  scoreSection: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: Spacing.md, marginBottom: Spacing.lg },
  scoreTitle: { fontSize: Font.sizes.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  scoreEmoji: { fontSize: 16 },
  scoreName: { fontSize: Font.sizes.sm, fontWeight: '700', color: Colors.text, width: 44 },
  scoreTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  scoreBar: { height: '100%', borderRadius: 4 },
  scorePct: { fontSize: Font.sizes.xs, fontWeight: '800', minWidth: 34, textAlign: 'right' },

  beginWrap: { borderRadius: 10, overflow: 'hidden', marginBottom: 32 },
  beginBtn: { paddingVertical: 15, alignItems: 'center' },
  beginTxt: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 0.3 },

  detailCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  detailHead: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  detailBody: { fontSize: 13, color: 'rgba(255,255,255,0.68)', lineHeight: 20, marginTop: 2 },
});
