// MySpace API — Firebase Firestore + Gemini REST (no backend server required)
import {
    collection, addDoc, getDocs, query, where, orderBy,
    limit as fsLimit, doc, updateDoc, setDoc, getDoc,
    serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Gemini (same key used in mission.tsx) ─────────────────────────────────────
const GEMINI_KEY = 'AIzaSyANg_oPfwORFiYwvWCs53hO2NSiw96xA8k';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

async function callGemini(prompt: string, maxTokens = 700): Promise<any> {
    try {
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7, maxOutputTokens: maxTokens,
                    responseMimeType: 'application/json',
                },
            }),
        });
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// ── Daily context (computed locally — no server needed) ───────────────────────
function getDailyContext() {
    const now = new Date();
    const hour = now.getHours();
    let energy_window: { name: string; best_for: string; color: string };
    if (hour >= 6 && hour < 10)
        energy_window = { name: 'Morning Grounding', best_for: 'intentions, body movement, gratitude', color: '#E9C46A' };
    else if (hour >= 10 && hour < 14)
        energy_window = { name: 'Peak Focus', best_for: 'deep work, decisions, complex tasks', color: '#F4A261' };
    else if (hour >= 14 && hour < 18)
        energy_window = { name: 'Creative Flow', best_for: 'creative work, communication, learning', color: '#2A9D8F' };
    else if (hour >= 18 && hour < 22)
        energy_window = { name: 'Wind Down', best_for: 'reflection, light tasks, relationships', color: '#457B9D' };
    else
        energy_window = { name: 'Deep Rest', best_for: 'emotional processing, dream capture', color: '#1D3557' };

    const m = now.getMonth() + 1;
    const season = m >= 3 && m <= 5 ? 'Spring' : m >= 6 && m <= 8 ? 'Summer' : m >= 9 && m <= 11 ? 'Autumn' : 'Winter';
    const daysSince = (now.getTime() - new Date('2024-01-11').getTime()) / 86400000;
    const cycle = ((daysSince % 29.53) + 29.53) % 29.53;
    const moon_phase = cycle < 2 || cycle > 27.5 ? 'New Moon' : cycle < 13 ? 'Waxing' : cycle < 16 ? 'Full Moon' : 'Waning';

    return {
        energy_window, moon_phase, season,
        current_hour: hour,
        current_date: now.toISOString().split('T')[0],
    };
}

export const myspaceApi = {

    // ── Context ───────────────────────────────────────────────────────────────
    getDailyContext: async () => getDailyContext(),

    // ── Journal ───────────────────────────────────────────────────────────────
    analyzeJournalEntry: async (payload: {
        user_id: string; content: string; entry_mode?: string;
        media_urls?: string[]; voice_transcript?: string; mood_score?: number;
    }) => {
        const context = getDailyContext();

        // Get user profile from Firestore
        let userName = 'Friend', dosha = 'Vata';
        try {
            const userDoc = await getDoc(doc(db, 'users', payload.user_id));
            if (userDoc.exists()) {
                userName = userDoc.data().name ?? 'Friend';
                dosha = userDoc.data().prakriti ?? 'Vata';
            }
        } catch { /* use defaults */ }

        // Get journal streak
        let streak = 0;
        try {
            const statsDoc = await getDoc(doc(db, 'user_wellness_stats', payload.user_id));
            if (statsDoc.exists()) streak = statsDoc.data().journalStreak ?? 0;
        } catch { /* use 0 */ }

        // Gemini AI analysis
        const prompt = `You are Bodhi — a warm, specific wellness companion. Never use clichés.
USER: ${userName}, ${dosha} type, ${context.energy_window.name} energy window, ${context.moon_phase}, ${context.season}, ${streak}-day journal streak.
ENTRY: """${payload.content}"""
Respond ONLY in valid JSON:
{"reflection":"2-3 warm sentences referencing energy context","pattern_insight":null,"energy_nudge":"one practical suggestion under 20 words","meditation_tip":null,"follow_up_prompt":"one specific question from what they wrote","daily_insight_quote":"most insightful sentence from their entry","mood_score":7,"energy_level":6,"dominant_emotion":"reflective","theme_tags":["general"],"stress_detected":false}`;

        let ai = await callGemini(prompt, 700);
        if (!ai) {
            ai = {
                reflection: 'Your thoughts are worth sitting with.',
                pattern_insight: null,
                energy_nudge: `You\'re in ${context.energy_window.name} — a good time to pause and breathe.`,
                meditation_tip: null,
                follow_up_prompt: 'What feels most unresolved right now?',
                daily_insight_quote: payload.content.slice(0, 120) || 'Today I showed up.',
                mood_score: payload.mood_score ?? 6,
                energy_level: 6,
                dominant_emotion: 'reflective',
                theme_tags: ['general'],
                stress_detected: false,
            };
        }

        // Save to Firestore
        const entryData = {
            userId: payload.user_id,
            entryDate: context.current_date,
            content: payload.content,
            entryMode: payload.entry_mode ?? 'free_write',
            mediaUrls: payload.media_urls ?? [],
            voiceTranscript: payload.voice_transcript ?? null,
            energyWindow: context.energy_window.name,
            moonPhase: context.moon_phase,
            season: context.season,
            moodScore: ai.mood_score,
            energyLevel: ai.energy_level,
            dominantEmotion: ai.dominant_emotion,
            themeTags: ai.theme_tags ?? [],
            stressDetected: ai.stress_detected ?? false,
            bodhiReflection: ai.reflection,
            bodhiPatternInsight: ai.pattern_insight ?? null,
            bodhiEnergyNudge: ai.energy_nudge,
            bodhiFollowUp: ai.follow_up_prompt,
            bodhiMeditationTip: ai.meditation_tip ?? null,
            dailyInsightQuote: ai.daily_insight_quote,
            streakDay: streak + 1,
            isArchived: false,
            createdAt: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, 'journal_entries'), entryData);

        // Update streak
        await setDoc(doc(db, 'user_wellness_stats', payload.user_id), {
            journalStreak: streak + 1,
            lastJournalDate: context.current_date,
        }, { merge: true });

        return { entry_id: ref.id, bodhi: ai, context };
    },

    getJournalEntries: async (user_id: string, lim = 20) => {
        try {
            const q = query(
                collection(db, 'journal_entries'),
                where('userId', '==', user_id),
                where('isArchived', '==', false),
                orderBy('createdAt', 'desc'),
                fsLimit(lim),
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    getOnThisDay: async (user_id: string) => {
        const today = new Date();
        const results: any[] = [];
        for (const offset of [1, 2, 3]) {
            try {
                const past = new Date(today);
                past.setFullYear(today.getFullYear() - offset);
                const dateStr = past.toISOString().split('T')[0];
                const q = query(
                    collection(db, 'journal_entries'),
                    where('userId', '==', user_id),
                    where('entryDate', '==', dateStr),
                );
                const snap = await getDocs(q);
                snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }));
            } catch { /* skip year */ }
        }
        return results;
    },

    getMoodHeatmap: async (user_id: string, year: number, month: number) => {
        try {
            const start = `${year}-${String(month).padStart(2, '0')}-01`;
            const end = `${year}-${String(month).padStart(2, '0')}-31`;
            const q = query(
                collection(db, 'journal_entries'),
                where('userId', '==', user_id),
                where('entryDate', '>=', start),
                where('entryDate', '<=', end),
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({
                entry_date: d.data().entryDate,
                mood_score: d.data().moodScore,
                dominant_emotion: d.data().dominantEmotion,
            }));
        } catch { return []; }
    },

    // ── Tasks ─────────────────────────────────────────────────────────────────
    brainDump: async (user_id: string, brain_dump: string, energy_level: number) => {
        const context = getDailyContext();
        const today = new Date().toISOString().split('T')[0];

        const prompt = `You are Bodhi — practical, direct, calm planning companion.
User energy today (1-10): ${energy_level}. Current window: ${context.energy_window.name}.
Brain dump: """${brain_dump}"""
Respond ONLY in valid JSON:
{"parsed_tasks":[{"title":"string","category":"Work|Health|Personal|Learning|Relationships|Other","priority":"high|medium|low","energy_required":"high|medium|low","suggested_energy_window":"Morning Grounding|Peak Focus|Creative Flow|Wind Down","suggested_time":"10:30 AM","bodhi_note":"max 10 words why this window"}],"overload_flag":false,"remove_suggestion":null,"wellness_task":null,"day_summary":"string","sustainability_score":7}`;

        let result = await callGemini(prompt, 1000);
        if (!result) return { parsed_tasks: [], day_summary: 'Could not parse. Add tasks manually.' };

        // Save tasks to Firestore
        for (const task of (result.parsed_tasks ?? [])) {
            await addDoc(collection(db, 'tasks'), {
                userId: user_id, taskDate: today,
                title: task.title, category: task.category ?? 'Personal',
                priority: task.priority ?? 'medium', energyRequired: task.energy_required ?? 'medium',
                suggestedEnergyWindow: task.suggested_energy_window,
                bodhiNote: task.bodhi_note, isBodhiSuggested: false,
                isCompleted: false, timesDeferred: 0, createdAt: serverTimestamp(),
            });
        }
        if (result.wellness_task) {
            await addDoc(collection(db, 'tasks'), {
                userId: user_id, taskDate: today,
                title: result.wellness_task.title ?? 'Wellness break',
                category: 'Health', priority: 'medium', energyRequired: 'low',
                suggestedEnergyWindow: 'Morning Grounding',
                bodhiNote: result.wellness_task.reason, isBodhiSuggested: true,
                isCompleted: false, timesDeferred: 0, createdAt: serverTimestamp(),
            });
        }
        return result;
    },

    createTask: async (payload: {
        user_id: string; title: string; category?: string; priority?: string;
        energy_required?: string; due_datetime?: string; notes?: string; media_url?: string;
    }) => {
        const context = getDailyContext();
        const energyToWindow: Record<string, string> = { high: 'Peak Focus', medium: 'Creative Flow', low: 'Wind Down' };
        const taskData = {
            userId: payload.user_id,
            taskDate: payload.due_datetime?.slice(0, 10) ?? context.current_date,
            title: payload.title, notes: payload.notes ?? null,
            category: payload.category ?? 'Personal', priority: payload.priority ?? 'medium',
            energyRequired: payload.energy_required ?? 'medium',
            suggestedEnergyWindow: energyToWindow[payload.energy_required ?? 'medium'] ?? 'Creative Flow',
            dueDatetime: payload.due_datetime ?? null, mediaUrl: payload.media_url ?? null,
            isCompleted: false, timesDeferred: 0, createdAt: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, 'tasks'), taskData);
        return { id: ref.id, ...taskData };
    },

    getTodayTasks: async (user_id: string) => {
        const context = getDailyContext();
        const today = context.current_date;
        try {
            const q = query(
                collection(db, 'tasks'),
                where('userId', '==', user_id),
                where('taskDate', '==', today),
            );
            const snap = await getDocs(q);
            const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
            const grouped: Record<string, any[]> = {
                'Morning Grounding': [], 'Peak Focus': [],
                'Creative Flow': [], 'Wind Down': [], 'Unscheduled': [],
            };
            for (const t of tasks) {
                const w = t.suggestedEnergyWindow ?? 'Unscheduled';
                (grouped[w] ?? (grouped[w] = [])).push(t);
            }
            const total = tasks.length;
            const completed = tasks.filter(t => t.isCompleted).length;
            return {
                tasks_by_window: grouped, total, completed,
                current_window: context.energy_window,
                completion_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
            };
        } catch { return { tasks_by_window: {}, total: 0, completed: 0, current_window: context.energy_window, completion_pct: 0 }; }
    },

    completeTask: async (task_id: string, user_id: string) => {
        const context = getDailyContext();
        const ref = doc(db, 'tasks', task_id);
        const snap = await getDoc(ref);
        const task = snap.data() ?? {};
        const priority = task.priority ?? 'medium';
        const base = ({ high: 30, medium: 20, low: 10 } as Record<string, number>)[priority] ?? 20;
        const inOptimal = task.suggestedEnergyWindow === context.energy_window.name;
        const karma = inOptimal ? Math.round(base * 1.5) : base;
        await updateDoc(ref, { isCompleted: true, completedAt: serverTimestamp(), karmaCreditsEarned: karma, completedInOptimalWindow: inOptimal });
        await setDoc(doc(db, 'user_wellness_stats', user_id), { karmaCredits: increment(karma) }, { merge: true });
        return { karma_earned: karma, in_optimal_window: inOptimal, bonus_applied: inOptimal, bodhi_message: inOptimal ? 'Clean execution.' : 'Done.' };
    },

    deferTask: async (task_id: string, user_id: string, reason?: string) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const ref = doc(db, 'tasks', task_id);
        const snap = await getDoc(ref);
        const timesDeferred = ((snap.data()?.timesDeferred ?? 0) as number) + 1;
        await updateDoc(ref, { taskDate: tomorrowStr, timesDeferred, deferredReason: reason ?? null });
        return { deferred_to: tomorrowStr, times_deferred: timesDeferred, bodhi_flag: timesDeferred >= 3 ? `You've moved this task ${timesDeferred} times. Still relevant?` : null };
    },

    getWeeklyReport: async (user_id: string) => {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        try {
            const q = query(collection(db, 'tasks'), where('userId', '==', user_id), where('taskDate', '>=', weekStartStr));
            const snap = await getDocs(q);
            const tasks = snap.docs.map(d => d.data()) as any[];
            const total = tasks.length, completed = tasks.filter(t => t.isCompleted).length;
            const optimal = tasks.filter(t => t.completedInOptimalWindow).length;
            const karma = tasks.reduce((s, t) => s + (t.karmaCreditsEarned ?? 0), 0);
            const cat: Record<string, number> = {};
            tasks.filter(t => t.isCompleted).forEach(t => { const c = t.category ?? 'Other'; cat[c] = (cat[c] ?? 0) + 1; });
            return { total_tasks: total, completed_tasks: completed, completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0, optimal_window_completions: optimal, karma_earned_this_week: karma, category_breakdown: cat, week_start: weekStartStr };
        } catch { return { total_tasks: 0, completed_tasks: 0, completion_rate: 0, optimal_window_completions: 0, karma_earned_this_week: 0, category_breakdown: {}, week_start: weekStartStr }; }
    },

    // ── Notes ─────────────────────────────────────────────────────────────────
    createNote: async (payload: {
        user_id: string; content: string; note_type?: string;
        media_url?: string; voice_transcript?: string;
    }) => {
        const context = getDailyContext();
        const noteData = {
            userId: payload.user_id,
            noteDate: context.current_date,
            content: payload.content,
            noteType: payload.note_type ?? 'quick',
            mediaUrl: payload.media_url ?? null,
            voiceTranscript: payload.voice_transcript ?? null,
            createdAt: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, 'notes'), noteData);
        return { id: ref.id, ...noteData };
    },

    getAllNotes: async (user_id: string, lim = 200) => {
        try {
            const q = query(
                collection(db, 'notes'),
                where('userId', '==', user_id),
                orderBy('createdAt', 'desc'),
                fsLimit(lim),
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    getPastIncompleteTasks: async (user_id: string) => {
        const today = new Date().toISOString().split('T')[0];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14);
        const cutoffDate = cutoff.toISOString().split('T')[0];
        try {
            const q = query(
                collection(db, 'tasks'),
                where('userId', '==', user_id),
                orderBy('createdAt', 'desc'),
                fsLimit(200),
            );
            const snap = await getDocs(q);
            return snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((t: any) => !t.isCompleted && t.taskDate < today && t.taskDate >= cutoffDate);
        } catch { return []; }
    },

    getTodayNotes: async (user_id: string) => {
        const today = new Date().toISOString().split('T')[0];
        try {
            const q = query(
                collection(db, 'notes'),
                where('userId', '==', user_id),
                where('noteDate', '==', today),
                orderBy('createdAt', 'desc'),
            );
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { return []; }
    },

    getNotesDigest: async (user_id: string) => {
        const today = new Date().toISOString().split('T')[0];
        try {
            const q = query(collection(db, 'notes'), where('userId', '==', user_id), where('noteDate', '==', today));
            const snap = await getDocs(q);
            const notes = snap.docs.map(d => d.data()) as any[];
            if (!notes.length) return { digest: null, has_notes: false };

            const allContent = notes.map(n => n.voiceTranscript || n.content || '').filter(Boolean).join('\n');
            const prompt = `You are Bodhi. User captured these notes today: """${allContent}"""
Respond ONLY in JSON: {"summary":"2-3 sentences about what they captured","standout_idea":"most interesting/actionable idea or null","suggested_tasks":["task 1","task 2"],"bodhi_message":"1 casual sentence about today's notes"}`;
            const digest = await callGemini(prompt, 300);
            return { digest, has_notes: true, note_count: notes.length };
        } catch { return { digest: null, has_notes: false }; }
    },
};
