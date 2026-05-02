import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { myspaceApi } from '@/lib/myspaceApi';
import TaskCard from '@/components/myspace/TaskCard';
import BrainDumpModal from '@/components/myspace/BrainDumpModal';
import WeeklyReportCard from '@/components/myspace/WeeklyReportCard';
import * as Haptics from 'expo-haptics';

const WINDOW_ORDER = ['Morning Grounding', 'Peak Focus', 'Creative Flow', 'Wind Down', 'Unscheduled'];
const WINDOW_EMOJI: Record<string, string> = {
    'Morning Grounding': '🌅',
    'Peak Focus': '🎯',
    'Creative Flow': '🎨',
    'Wind Down': '🌙',
    'Unscheduled': '📋',
};
const WINDOW_COLORS: Record<string, string> = {
    'Morning Grounding': '#E9C46A',
    'Peak Focus': '#F4A261',
    'Creative Flow': '#2A9D8F',
    'Wind Down': '#457B9D',
    'Unscheduled': Colors.textMuted,
};

export default function TasksTab({
    userId,
    context,
}: {
    userId: string;
    context: any;
}) {
    const [taskData, setTaskData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [brainDumpOpen, setBrainDumpOpen] = useState(false);
    const [weeklyReport, setWeeklyReport] = useState<any>(null);
    const [showReport, setShowReport] = useState(false);
    const [pastTasks, setPastTasks] = useState<any[]>([]);
    const [carryExpanded, setCarryExpanded] = useState(false);

    const loadTasks = useCallback(async () => {
        try {
            const data = await myspaceApi.getTodayTasks(userId);
            setTaskData(data);
        } catch {
            setTaskData(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    const loadPastTasks = useCallback(async () => {
        try {
            const data = await myspaceApi.getPastIncompleteTasks(userId);
            setPastTasks(Array.isArray(data) ? data : []);
        } catch { setPastTasks([]); }
    }, [userId]);

    useEffect(() => { loadTasks(); loadPastTasks(); }, [loadTasks, loadPastTasks]);

    const onRefresh = () => { setRefreshing(true); loadTasks(); };

    const handleComplete = async (taskId: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        try {
            const res = await myspaceApi.completeTask(taskId, userId);
            if (res.karma_earned) {
                Alert.alert(
                    res.in_optimal_window ? '⚡ Optimal timing!' : '✓ Done',
                    `+${res.karma_earned} karma credits earned`,
                    [{ text: 'Nice' }]
                );
            }
            await loadTasks();
        } catch {
            Alert.alert('Error', 'Could not complete task. Try again.');
        }
    };

    const handleDefer = async (taskId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const res = await myspaceApi.deferTask(taskId, userId);
            if (res.bodhi_flag) {
                Alert.alert('Bodhi', res.bodhi_flag);
            }
            await loadTasks();
        } catch {
            Alert.alert('Error', 'Could not defer task.');
        }
    };

    const handleMoveToToday = async (taskId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const today = new Date().toISOString().split('T')[0];
            const { doc: docFn, updateDoc } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            await updateDoc(docFn(db, 'tasks', taskId), { taskDate: today });
            await Promise.all([loadTasks(), loadPastTasks()]);
        } catch { Alert.alert('Error', 'Could not move task.'); }
    };

    const loadWeeklyReport = async () => {
        try {
            const data = await myspaceApi.getWeeklyReport(userId);
            setWeeklyReport(data);
            setShowReport(true);
        } catch { }
    };

    // Flatten tasks into section list
    const windows = WINDOW_ORDER.filter(
        w => (taskData?.tasks_by_window?.[w]?.length ?? 0) > 0
    );
    const allEmpty = windows.length === 0 && !loading;
    const fmtTaskDate = (d: string) => {
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        if (d === yest.toISOString().split('T')[0]) return 'Yesterday';
        return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const currentWindow = taskData?.current_window;

    return (
        <View style={styles.container}>
            {/* Weekly report overlay */}
            {showReport && weeklyReport && (
                <View style={styles.reportOverlay}>
                    <WeeklyReportCard stats={weeklyReport} onClose={() => setShowReport(false)} />
                </View>
            )}

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.gold} />
                </View>
            ) : (
                <FlatList
                    data={windows}
                    keyExtractor={(w) => w}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
                    }
                    ListHeaderComponent={
                        <View>
                            {/* Hero stats bar */}
                            {taskData && (
                                <View style={styles.statsBar}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{taskData.completed}/{taskData.total}</Text>
                                        <Text style={styles.statLabel}>Done today</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={[styles.statValue, { color: Colors.gold }]}>
                                            {taskData.completion_pct}%
                                        </Text>
                                        <Text style={styles.statLabel}>Complete</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        {currentWindow ? (
                                            <>
                                                <Text style={styles.statValue}>
                                                    {WINDOW_EMOJI[currentWindow.name] ?? '⏰'}
                                                </Text>
                                                <Text style={styles.statLabel} numberOfLines={1}>
                                                    {currentWindow.name?.split(' ')[0]}
                                                </Text>
                                            </>
                                        ) : <Text style={styles.statLabel}>—</Text>}
                                    </View>
                                </View>
                            )}

                            {/* Brain dump + weekly report buttons */}
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={styles.brainDumpBtn}
                                    onPress={() => setBrainDumpOpen(true)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.brainDumpIcon}>🧠</Text>
                                    <Text style={styles.brainDumpText}>Brain Dump</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.reportBtn} onPress={loadWeeklyReport} activeOpacity={0.8}>
                                    <Text style={styles.reportIcon}>📊</Text>
                                    <Text style={styles.reportText}>Weekly</Text>
                                </TouchableOpacity>
                            </View>

                            {allEmpty && (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyEmoji}>✅</Text>
                                    <Text style={styles.emptyTitle}>No tasks today</Text>
                                    <Text style={styles.emptySub}>
                                        Use Brain Dump to plan your day with Bodhi, or tasks will appear after you create them.
                                    </Text>
                                </View>
                            )}
                        </View>
                    }
                    renderItem={({ item: window }) => {
                        const tasks: any[] = taskData?.tasks_by_window?.[window] ?? [];
                        const wc = WINDOW_COLORS[window] ?? Colors.textMuted;
                        return (
                            <View style={styles.windowSection}>
                                <View style={styles.windowHeader}>
                                    <Text style={styles.windowEmoji}>{WINDOW_EMOJI[window]}</Text>
                                    <Text style={[styles.windowName, { color: wc }]}>{window}</Text>
                                    <Text style={styles.windowCount}>{tasks.length}</Text>
                                </View>
                                {tasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onComplete={handleComplete}
                                        onDefer={handleDefer}
                                    />
                                ))}
                            </View>
                        );
                    }}
                />
            )}

            {/* ── Carry Forward — past incomplete tasks ── */}
            {pastTasks.length > 0 && (
                <View style={styles.carryWrap}>
                    <TouchableOpacity
                        style={styles.carryHeader}
                        onPress={() => setCarryExpanded(v => !v)}
                        activeOpacity={0.8}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.carryIcon}>📥</Text>
                            <Text style={styles.carryTitle}>Carry Forward</Text>
                            <View style={styles.carryBadge}>
                                <Text style={styles.carryBadgeTxt}>{pastTasks.length}</Text>
                            </View>
                        </View>
                        <Text style={styles.carryChevron}>{carryExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {carryExpanded && pastTasks.map(task => (
                        <View key={task.id} style={styles.carryCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.carryTaskDate}>{fmtTaskDate(task.taskDate)}</Text>
                                <Text style={styles.carryTaskTitle} numberOfLines={2}>{task.title}</Text>
                                {task.bodhiNote ? (
                                    <Text style={styles.carryNote} numberOfLines={1}>{task.bodhiNote}</Text>
                                ) : null}
                            </View>
                            <View style={styles.carryActions}>
                                <TouchableOpacity
                                    style={styles.moveBtn}
                                    onPress={() => handleMoveToToday(task.id)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.moveBtnTxt}>Move to Today</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.doneBtn}
                                    onPress={() => handleComplete(task.id)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.doneBtnTxt}>✓</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Brain Dump modal */}
            <BrainDumpModal
                visible={brainDumpOpen}
                userId={userId}
                onClose={() => setBrainDumpOpen(false)}
                onTasksCreated={() => { loadTasks(); }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 16, paddingBottom: 40 },
    statsBar: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '900', color: Colors.text },
    statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
    statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    brainDumpBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#2A9D8F',
        borderRadius: 12,
        padding: 14,
    },
    brainDumpIcon: { fontSize: 18 },
    brainDumpText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    reportBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    reportIcon: { fontSize: 16 },
    reportText: { color: Colors.textSub, fontSize: 13, fontWeight: '600' },
    emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
    emptySub: {
        fontSize: 13,
        color: Colors.textSub,
        textAlign: 'center',
        lineHeight: 20,
    },
    windowSection: { marginBottom: 20 },
    windowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    windowEmoji: { fontSize: 16 },
    windowName: { fontSize: 13, fontWeight: '800', flex: 1, letterSpacing: 0.3 },
    windowCount: {
        fontSize: 11,
        color: Colors.textMuted,
        backgroundColor: Colors.surface,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: Colors.border,
        fontWeight: '700',
    },
    reportOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 100, backgroundColor: Colors.bg, padding: 16, paddingTop: 20,
    },
    carryWrap: {
        marginHorizontal: 16, marginBottom: 24,
        borderWidth: 1, borderColor: Colors.border,
        borderRadius: 16, overflow: 'hidden',
    },
    carryHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 14, backgroundColor: Colors.surface,
    },
    carryIcon: { fontSize: 16 },
    carryTitle: { fontSize: 13, fontWeight: '800', color: Colors.text },
    carryBadge: {
        backgroundColor: '#F4A26130', borderRadius: 99,
        paddingHorizontal: 8, paddingVertical: 2,
        borderWidth: 1, borderColor: '#F4A26160',
    },
    carryBadgeTxt: { fontSize: 11, color: '#F4A261', fontWeight: '800' },
    carryChevron: { fontSize: 9, color: Colors.textMuted },
    carryCard: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: 12, backgroundColor: Colors.card,
        borderTopWidth: 1, borderTopColor: Colors.border,
    },
    carryTaskDate: { fontSize: 9, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    carryTaskTitle: { fontSize: 13, color: Colors.text, fontWeight: '600', lineHeight: 18 },
    carryNote: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
    carryActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    moveBtn: {
        backgroundColor: '#2A9D8F20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
        borderWidth: 1, borderColor: '#2A9D8F40',
    },
    moveBtnTxt: { fontSize: 11, color: '#2A9D8F', fontWeight: '700' },
    doneBtn: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: '#10B98120',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#10B98145',
    },
    doneBtnTxt: { fontSize: 14, color: '#10B981', fontWeight: '800' },
});
