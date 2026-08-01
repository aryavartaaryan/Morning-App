import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { myspaceApi } from '@/lib/myspaceApi';
import BodhiResponseCard from './BodhiResponseCard';
import BreathingModal from './BreathingModal';
import { Colors } from '@/constants/theme';

const MOODS = [
    { emoji: '😔', label: 'Low', score: 2 },
    { emoji: '😐', label: 'Meh', score: 4 },
    { emoji: '🙂', label: 'Okay', score: 6 },
    { emoji: '😊', label: 'Good', score: 8 },
    { emoji: '🌟', label: 'Peak', score: 10 },
];

const ENTRY_PROMPTS: Record<string, string> = {
    'Morning Grounding': 'What intention do you want to carry into today?',
    'Peak Focus': "What's the one thing that truly needs your attention right now?",
    'Creative Flow': "What idea has been quietly knocking on the door of your mind?",
    'Wind Down': 'What was the most honest moment you had today?',
    'Deep Rest': "What are you carrying that you haven't said out loud yet?",
};

export default function JournalEntryComposer({
    userId,
    context,
    onSaved,
    onCancel,
}: {
    userId: string;
    context: any;
    onSaved: (entry: any) => void;
    onCancel: () => void;
}) {
    const [content, setContent] = useState('');
    const [moodIndex, setMoodIndex] = useState(2);
    const [loading, setLoading] = useState(false);
    const [bodhiResponse, setBodhiResponse] = useState<any>(null);
    const [showBreathing, setShowBreathing] = useState(false);

    const todayPrompt =
        ENTRY_PROMPTS[context?.energy_window?.name ?? ''] ??
        "What's on your mind right now?";

    const handleSaveAndReflect = async () => {
        if (!content.trim()) {
            Alert.alert('Write something first', 'Even a few words is enough.');
            return;
        }
        setLoading(true);
        try {
            const result = await myspaceApi.analyzeJournalEntry({
                user_id: userId,
                content,
                entry_mode: 'free_write',
                mood_score: MOODS[moodIndex].score,
            });
            setBodhiResponse(result.bodhi);
            if (result.bodhi?.stress_detected && result.bodhi?.meditation_tip) {
                setShowBreathing(true);
            }
            onSaved(result);
        } catch {
            Alert.alert('Error', 'Could not save entry. Check your connection.');
        } finally {
            setLoading(false);
        }
    };

    if (bodhiResponse) {
        return (
            <>
                <BodhiResponseCard
                    response={bodhiResponse}
                    onContinueWriting={() => {
                        setBodhiResponse(null);
                        setContent('');
                    }}
                    onDone={onCancel}
                />
                {showBreathing && bodhiResponse?.meditation_tip && (
                    <BreathingModal
                        tip={bodhiResponse.meditation_tip}
                        onClose={() => setShowBreathing(false)}
                    />
                )}
            </>
        );
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Context bar */}
            <View style={styles.contextBar}>
                <Text style={styles.contextText}>
                    {context?.energy_window?.name ?? '—'} · {context?.moon_phase ?? ''} · {context?.season ?? ''}
                </Text>
            </View>

            {/* Today's prompt */}
            <View style={styles.promptCard}>
                <Text style={styles.promptLabel}>Today's prompt</Text>
                <Text style={styles.promptText}>"{todayPrompt}"</Text>
                <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
            </View>

            {/* Text editor */}
            <TextInput
                style={styles.textInput}
                placeholder="Write freely here..."
                placeholderTextColor={Colors.textMuted}
                multiline
                value={content}
                onChangeText={setContent}
                textAlignVertical="top"
                autoFocus
            />

            {/* Mood selector */}
            <View style={styles.moodSection}>
                <Text style={styles.moodLabel}>How are you feeling?</Text>
                <View style={styles.moodRow}>
                    {MOODS.map((m, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.moodBtn, moodIndex === i && styles.moodBtnActive]}
                            onPress={() => setMoodIndex(i)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.moodEmoji}>{m.emoji}</Text>
                            <Text style={[styles.moodBtnLabel, moodIndex === i && styles.moodBtnLabelActive]}>
                                {m.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.saveBtn, (!content.trim() || loading) && styles.disabledBtn]}
                    onPress={handleSaveAndReflect}
                    disabled={!content.trim() || loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveBtnText}>Save + Reflect ✨</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={{ height: 60 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: 20 },
    contextBar: {
        backgroundColor: Colors.surface,
        borderRadius: 8,
        padding: 8,
        marginVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    contextText: { fontSize: 11, color: Colors.textMuted, letterSpacing: 0.5 },
    promptCard: {
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#2A9D8F',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    promptLabel: {
        fontSize: 9,
        color: Colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontWeight: '800',
        marginBottom: 6,
    },
    promptText: { fontSize: 14, color: Colors.text, lineHeight: 22, fontStyle: 'italic' },
    backBtn: { marginTop: 10, alignSelf: 'flex-start', zIndex: 100, elevation: 100 },
    backBtnText: { fontSize: 12, color: '#2A9D8F', fontWeight: '700' },
    textInput: {
        minHeight: 200,
        backgroundColor: Colors.card,
        borderRadius: 14,
        padding: 16,
        fontSize: 16,
        color: Colors.text,
        lineHeight: 28,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    moodSection: { marginBottom: 20 },
    moodLabel: { fontSize: 12, color: Colors.textSub, marginBottom: 10, fontWeight: '600' },
    moodRow: { flexDirection: 'row', gap: 8 },
    moodBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    moodBtnActive: { borderColor: '#2A9D8F', backgroundColor: '#2A9D8F20' },
    moodEmoji: { fontSize: 22, marginBottom: 3 },
    moodBtnLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
    moodBtnLabelActive: { color: '#2A9D8F' },
    actionRow: { flexDirection: 'row', gap: 12 },
    cancelBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    cancelBtnText: { color: Colors.textSub, fontSize: 14, fontWeight: '600' },
    saveBtn: {
        flex: 2,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#2A9D8F',
        alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    disabledBtn: { opacity: 0.4 },
});
