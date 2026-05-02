import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

const CATEGORY_COLORS: Record<string, string> = {
    Work: '#3B82F6',
    Health: '#10B981',
    Personal: '#8B5CF6',
    Learning: '#F59E0B',
    Relationships: '#EC4899',
    Other: '#6B7280',
};
const PRIORITY_DOT: Record<string, string> = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981',
};

interface TaskCardProps {
    task: {
        id: string;
        title: string;
        category?: string;
        priority?: string;
        energy_required?: string;
        is_completed?: boolean;
        bodhi_note?: string;
        times_deferred?: number;
        suggested_energy_window?: string;
        karma_credits_earned?: number;
    };
    onComplete: (id: string) => void;
    onDefer: (id: string) => void;
}

export default function TaskCard({ task, onComplete, onDefer }: TaskCardProps) {
    const cat = task.category ?? 'Other';
    const pri = task.priority ?? 'medium';
    const catColor = CATEGORY_COLORS[cat] ?? '#6B7280';

    return (
        <View style={[styles.card, task.is_completed && styles.completedCard]}>
            {/* Complete checkbox */}
            <TouchableOpacity
                style={[styles.checkbox, task.is_completed && styles.checkboxDone]}
                onPress={() => !task.is_completed && onComplete(task.id)}
                activeOpacity={0.7}
            >
                {task.is_completed && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            {/* Content */}
            <View style={styles.content}>
                <Text style={[styles.title, task.is_completed && styles.completedTitle]} numberOfLines={2}>
                    {task.title}
                </Text>
                <View style={styles.meta}>
                    <View style={[styles.categoryPill, { backgroundColor: catColor + '22' }]}>
                        <Text style={[styles.categoryText, { color: catColor }]}>{cat}</Text>
                    </View>
                    {task.bodhi_note ? (
                        <Text style={styles.bodhiNote} numberOfLines={1}>{task.bodhi_note}</Text>
                    ) : null}
                </View>
                {(task.times_deferred ?? 0) >= 3 && !task.is_completed && (
                    <Text style={styles.deferWarning}>⚠ Moved {task.times_deferred}× — still relevant?</Text>
                )}
                {task.is_completed && (task.karma_credits_earned ?? 0) > 0 && (
                    <Text style={styles.karmaText}>+{task.karma_credits_earned} karma ⚡</Text>
                )}
            </View>

            {/* Priority dot */}
            <View style={[styles.priorityDot, { backgroundColor: PRIORITY_DOT[pri] ?? '#F59E0B' }]} />

            {/* Defer button */}
            {!task.is_completed && (
                <TouchableOpacity style={styles.deferBtn} onPress={() => onDefer(task.id)} activeOpacity={0.7}>
                    <Text style={styles.deferIcon}>→</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 12,
    },
    completedCard: { opacity: 0.45 },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#2A9D8F',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxDone: { backgroundColor: '#2A9D8F', borderColor: '#2A9D8F' },
    checkIcon: { color: '#fff', fontSize: 13, fontWeight: '900' },
    content: { flex: 1 },
    title: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '600',
        marginBottom: 5,
        lineHeight: 20,
    },
    completedTitle: { textDecorationLine: 'line-through', color: Colors.textMuted },
    meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    categoryPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
    categoryText: { fontSize: 10, fontWeight: '700' },
    bodhiNote: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic', flex: 1 },
    deferWarning: { fontSize: 10, color: '#F59E0B', marginTop: 4 },
    karmaText: { fontSize: 10, color: Colors.gold, marginTop: 3, fontWeight: '700' },
    priorityDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    deferBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    deferIcon: { fontSize: 14, color: Colors.textSub },
});
