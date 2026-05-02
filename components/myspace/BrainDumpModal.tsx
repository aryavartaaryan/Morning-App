import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { Colors } from '@/constants/theme';

const ENERGY_LABELS = ['💤 Very Low', '😴 Low', '😐 Medium', '⚡ High', '🔥 Peak'];

interface BrainDumpModalProps {
    visible: boolean;
    userId: string;
    onClose: () => void;
    onTasksCreated: (result: any) => void;
}

export default function BrainDumpModal({
    visible,
    userId,
    onClose,
    onTasksCreated,
}: BrainDumpModalProps) {
    const [dump, setDump] = useState('');
    const [energyLevel, setEnergyLevel] = useState(3); // 1-5 → maps to 2-10
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const handleAnalyze = async () => {
        if (!dump.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const { myspaceApi } = await import('@/lib/myspaceApi');
            const res = await myspaceApi.brainDump(userId, dump, energyLevel * 2); // scale to 1-10
            setResult(res);
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        } catch (e) {
            setResult({ error: 'Could not analyse. Try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (result) {
            onTasksCreated(result);
            setDump('');
            setResult(null);
            fadeAnim.setValue(0);
            onClose();
        }
    };

    const handleClose = () => {
        setDump('');
        setResult(null);
        fadeAnim.setValue(0);
        onClose();
    };

    const WINDOW_COLORS: Record<string, string> = {
        'Morning Grounding': '#E9C46A',
        'Peak Focus': '#F4A261',
        'Creative Flow': '#2A9D8F',
        'Wind Down': '#457B9D',
    };

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Handle bar */}
                    <View style={styles.handle} />

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.title}>Brain Dump</Text>
                                <Text style={styles.subtitle}>Tell Bodhi everything on your mind today</Text>
                            </View>
                            <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
                                <Text style={styles.closeIconText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {!result ? (
                            <>
                                {/* Energy selector */}
                                <Text style={styles.sectionLabel}>Today's energy level</Text>
                                <View style={styles.energyRow}>
                                    {ENERGY_LABELS.map((label, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={[
                                                styles.energyBtn,
                                                energyLevel === i + 1 && styles.energyBtnActive,
                                            ]}
                                            onPress={() => setEnergyLevel(i + 1)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.energyEmoji}>{label.split(' ')[0]}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={styles.energyLabel}>{ENERGY_LABELS[energyLevel - 1]}</Text>

                                {/* Text input */}
                                <Text style={styles.sectionLabel}>What's on your plate today?</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder={
                                        'e.g. Reply to the investor email, gym session, call mom, finish the deck, book dentist...'
                                    }
                                    placeholderTextColor={Colors.textMuted}
                                    multiline
                                    value={dump}
                                    onChangeText={setDump}
                                    textAlignVertical="top"
                                />

                                <TouchableOpacity
                                    style={[styles.analyzeBtn, (!dump.trim() || loading) && styles.disabledBtn]}
                                    onPress={handleAnalyze}
                                    disabled={!dump.trim() || loading}
                                    activeOpacity={0.8}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.analyzeBtnText}>Plan my day with Bodhi ✨</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        ) : result.error ? (
                            <View style={styles.errorCard}>
                                <Text style={styles.errorText}>{result.error}</Text>
                                <TouchableOpacity onPress={() => setResult(null)} style={styles.retryBtn}>
                                    <Text style={styles.retryBtnText}>Try again</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Animated.View style={{ opacity: fadeAnim }}>
                                {/* Day summary */}
                                {result.day_summary ? (
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summaryLabel}>Bodhi's read</Text>
                                        <Text style={styles.summaryText}>{result.day_summary}</Text>
                                        {result.sustainability_score != null && (
                                            <View style={styles.scoreRow}>
                                                <Text style={styles.scoreLabel}>Sustainability</Text>
                                                <Text style={styles.scoreValue}>{result.sustainability_score}/10</Text>
                                            </View>
                                        )}
                                    </View>
                                ) : null}

                                {/* Overload warning */}
                                {result.overload_flag && result.remove_suggestion ? (
                                    <View style={styles.overloadCard}>
                                        <Text style={styles.overloadText}>
                                            ⚠ Overloaded — consider removing: "{result.remove_suggestion}"
                                        </Text>
                                    </View>
                                ) : null}

                                {/* Parsed tasks */}
                                {(result.parsed_tasks ?? []).map((task: any, i: number) => {
                                    const wc = WINDOW_COLORS[task.suggested_energy_window] ?? Colors.gold;
                                    return (
                                        <View key={i} style={styles.taskRow}>
                                            <View style={[styles.windowAccent, { backgroundColor: wc }]} />
                                            <View style={styles.taskContent}>
                                                <Text style={styles.taskTitle}>{task.title}</Text>
                                                <View style={styles.taskMeta}>
                                                    <Text style={[styles.windowTag, { color: wc }]}>
                                                        {task.suggested_energy_window}
                                                    </Text>
                                                    {task.suggested_time ? (
                                                        <Text style={styles.taskTime}>{task.suggested_time}</Text>
                                                    ) : null}
                                                </View>
                                                {task.bodhi_note ? (
                                                    <Text style={styles.taskNote}>{task.bodhi_note}</Text>
                                                ) : null}
                                            </View>
                                            <View
                                                style={[
                                                    styles.priorityDot,
                                                    {
                                                        backgroundColor:
                                                            task.priority === 'high'
                                                                ? '#EF4444'
                                                                : task.priority === 'medium'
                                                                    ? '#F59E0B'
                                                                    : '#10B981',
                                                    },
                                                ]}
                                            />
                                        </View>
                                    );
                                })}

                                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
                                    <Text style={styles.confirmBtnText}>Add {result.parsed_tasks?.length ?? 0} tasks to today ✓</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(4,4,10,0.85)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        maxHeight: '92%',
        borderTopWidth: 1,
        borderColor: Colors.border,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    title: { fontSize: 22, fontWeight: '900', color: Colors.text },
    subtitle: { fontSize: 13, color: Colors.textSub, marginTop: 3 },
    closeIcon: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeIconText: { color: Colors.textMuted, fontSize: 18 },
    sectionLabel: {
        fontSize: 11,
        color: Colors.textMuted,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    energyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    energyBtn: {
        flex: 1,
        height: 44,
        borderRadius: 10,
        backgroundColor: Colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    energyBtnActive: { borderColor: '#2A9D8F', backgroundColor: '#2A9D8F20' },
    energyEmoji: { fontSize: 20 },
    energyLabel: {
        fontSize: 12,
        color: Colors.textSub,
        textAlign: 'center',
        marginBottom: 16,
        fontWeight: '600',
    },
    textInput: {
        minHeight: 140,
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: Colors.text,
        lineHeight: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    analyzeBtn: {
        backgroundColor: '#2A9D8F',
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
        marginBottom: 8,
    },
    analyzeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    disabledBtn: { opacity: 0.4 },
    errorCard: {
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: Colors.error + '40',
    },
    errorText: { color: Colors.error, fontSize: 14, textAlign: 'center' },
    retryBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.error,
    },
    retryBtnText: { color: Colors.error, fontSize: 13, fontWeight: '700' },
    summaryCard: {
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    summaryLabel: {
        fontSize: 9,
        color: '#2A9D8F',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontWeight: '800',
        marginBottom: 8,
    },
    summaryText: { fontSize: 14, color: Colors.text, lineHeight: 22 },
    scoreRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    scoreLabel: { fontSize: 12, color: Colors.textMuted },
    scoreValue: { fontSize: 16, color: Colors.gold, fontWeight: '800' },
    overloadCard: {
        backgroundColor: '#F59E0B15',
        borderRadius: 10,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#F59E0B40',
    },
    overloadText: { fontSize: 13, color: '#F59E0B', fontWeight: '600' },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: 10,
        marginBottom: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 12,
    },
    windowAccent: { width: 4, alignSelf: 'stretch' },
    taskContent: { flex: 1, padding: 12 },
    taskTitle: { fontSize: 14, color: Colors.text, fontWeight: '600', marginBottom: 4 },
    taskMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    windowTag: { fontSize: 11, fontWeight: '700' },
    taskTime: { fontSize: 11, color: Colors.textMuted },
    taskNote: { fontSize: 11, color: Colors.textMuted, marginTop: 3, fontStyle: 'italic' },
    priorityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
    confirmBtn: {
        backgroundColor: '#2A9D8F',
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
        marginTop: 8,
    },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
