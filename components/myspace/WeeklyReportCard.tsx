import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

interface WeeklyStats {
    total_tasks: number;
    completed_tasks: number;
    completion_rate: number;
    optimal_window_completions: number;
    karma_earned_this_week: number;
    category_breakdown: Record<string, number>;
    week_start: string;
}

export default function WeeklyReportCard({
    stats,
    onClose,
}: {
    stats: WeeklyStats;
    onClose: () => void;
}) {
    const topCats = Object.entries(stats.category_breakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Weekly Report</Text>
                    <Text style={styles.subtitle}>
                        Week of {new Date(stats.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
            </View>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
                <StatBox
                    value={`${stats.completion_rate}%`}
                    label="Completed"
                    color={stats.completion_rate >= 70 ? '#10B981' : '#F59E0B'}
                />
                <StatBox
                    value={`${stats.completed_tasks}/${stats.total_tasks}`}
                    label="Tasks Done"
                    color='#2A9D8F'
                />
                <StatBox
                    value={`${stats.karma_earned_this_week}`}
                    label="Karma ⚡"
                    color={Colors.gold}
                />
                <StatBox
                    value={`${stats.optimal_window_completions}`}
                    label="Optimal ✓"
                    color='#8B5CF6'
                />
            </View>

            {/* Category breakdown */}
            {topCats.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Top categories this week</Text>
                    {topCats.map(([cat, count]) => (
                        <View key={cat} style={styles.catRow}>
                            <Text style={styles.catName}>{cat}</Text>
                            <View style={styles.catBarBg}>
                                <View
                                    style={[
                                        styles.catBarFill,
                                        {
                                            width: `${Math.round((count / stats.completed_tasks) * 100)}%`,
                                            backgroundColor:
                                                cat === 'Work' ? '#3B82F6' :
                                                    cat === 'Health' ? '#10B981' :
                                                        cat === 'Personal' ? '#8B5CF6' :
                                                            cat === 'Learning' ? '#F59E0B' : '#2A9D8F',
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.catCount}>{count}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Bodhi insight */}
            <View style={styles.bodhiInsight}>
                <Text style={styles.bodhiInsightLabel}>🌿 Bodhi</Text>
                <Text style={styles.bodhiInsightText}>
                    {stats.completion_rate >= 80
                        ? 'Excellent execution this week. Your energy rhythm alignment is strong.'
                        : stats.completion_rate >= 50
                            ? 'Solid progress. Completing tasks in their optimal windows will lift your score next week.'
                            : 'A lighter week. That\'s okay — start this week with Brain Dump to structure your energy.'}
                </Text>
            </View>
        </View>
    );
}

function StatBox({ value, label, color }: { value: string; label: string; color: string }) {
    return (
        <View style={styles.statBox}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    title: { fontSize: 18, fontWeight: '900', color: Colors.text },
    subtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
    closeBtn: { padding: 4 },
    closeText: { color: Colors.textMuted, fontSize: 16 },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    statBox: {
        flex: 1,
        minWidth: '44%',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    statValue: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
    statLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
    section: { marginBottom: 16 },
    sectionLabel: {
        fontSize: 10,
        color: Colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '800',
        marginBottom: 10,
    },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    catName: { fontSize: 12, color: Colors.textSub, width: 80 },
    catBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: Colors.surface,
        borderRadius: 3,
        overflow: 'hidden',
    },
    catBarFill: { height: 6, borderRadius: 3 },
    catCount: { fontSize: 12, color: Colors.textMuted, width: 20, textAlign: 'right', fontWeight: '700' },
    bodhiInsight: {
        backgroundColor: '#2A9D8F12',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#2A9D8F30',
    },
    bodhiInsightLabel: { fontSize: 12, color: '#2A9D8F', fontWeight: '700', marginBottom: 6 },
    bodhiInsightText: { fontSize: 13, color: Colors.textSub, lineHeight: 20 },
});
