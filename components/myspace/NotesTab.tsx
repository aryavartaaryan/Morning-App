import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
    StyleSheet, ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { myspaceApi } from '@/lib/myspaceApi';
import NoteCard from '@/components/myspace/NoteCard';
import * as Haptics from 'expo-haptics';

function fmtDateLabel(dateStr: string): string {
    const today = new Date().toISOString().split('T')[0];
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yesterdayStr = yest.toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    });
}

export default function NotesTab({ userId }: { userId: string }) {
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [quickNote, setQuickNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [digest, setDigest] = useState<any>(null);
    const [digestLoading, setDigestLoading] = useState(false);
    const successAnim = useRef(new Animated.Value(0)).current;
    const [viewMode, setViewMode] = useState<'today' | 'all'>('today');
    const [allNotes, setAllNotes] = useState<any[]>([]);
    const [allLoading, setAllLoading] = useState(false);

    const loadNotes = useCallback(async () => {
        try {
            const data = await myspaceApi.getTodayNotes(userId);
            setNotes(Array.isArray(data) ? data : []);
        } catch {
            setNotes([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    const loadAllNotes = useCallback(async () => {
        setAllLoading(true);
        try {
            const data = await myspaceApi.getAllNotes(userId);
            setAllNotes(Array.isArray(data) ? data : []);
        } catch {
            setAllNotes([]);
        } finally {
            setAllLoading(false);
        }
    }, [userId]);

    useEffect(() => { loadNotes(); }, [loadNotes]);

    const groupedByDate = useMemo(() => {
        const groups: Record<string, any[]> = {};
        for (const note of allNotes) {
            const d = note.noteDate ?? 'unknown';
            if (!groups[d]) groups[d] = [];
            groups[d].push(note);
        }
        return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
    }, [allNotes]);

    const switchMode = (mode: 'today' | 'all') => {
        setViewMode(mode);
        if (mode === 'all' && allNotes.length === 0) loadAllNotes();
    };

    const onRefresh = () => { setRefreshing(true); loadNotes(); };

    const handleSaveNote = async () => {
        if (!quickNote.trim()) return;
        setSaving(true);
        try {
            await myspaceApi.createNote({ user_id: userId, content: quickNote });
            setQuickNote('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Animate success
            successAnim.setValue(1);
            Animated.timing(successAnim, { toValue: 0, duration: 800, useNativeDriver: true }).start();
            await loadNotes();
        } catch {
        } finally {
            setSaving(false);
        }
    };

    const handleConvertToTask = async (note: any) => {
        try {
            await myspaceApi.createTask({
                user_id: userId,
                title: note.content?.substring(0, 80) ?? 'Task from note',
                notes: note.content,
                category: 'Personal',
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch { }
    };

    const loadDigest = async () => {
        setDigestLoading(true);
        try {
            const res = await myspaceApi.getNotesDigest(userId);
            setDigest(res);
        } catch {
        } finally {
            setDigestLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* ── View mode toggle ── */}
            <View style={styles.segmentWrap}>
                <TouchableOpacity
                    style={[styles.segment, viewMode === 'today' && styles.segmentActive]}
                    onPress={() => switchMode('today')}
                    activeOpacity={0.75}
                >
                    <Text style={[styles.segmentTxt, viewMode === 'today' && styles.segmentTxtActive]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segment, viewMode === 'all' && styles.segmentActive]}
                    onPress={() => switchMode('all')}
                    activeOpacity={0.75}
                >
                    <Text style={[styles.segmentTxt, viewMode === 'all' && styles.segmentTxtActive]}>All Notes</Text>
                </TouchableOpacity>
            </View>

            {/* ── All Notes history view ── */}
            {viewMode === 'all' ? (
                <ScrollView contentContainerStyle={styles.allList} showsVerticalScrollIndicator={false}>
                    {allLoading ? (
                        <ActivityIndicator color={Colors.gold} style={{ marginTop: 40 }} />
                    ) : groupedByDate.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>📝</Text>
                            <Text style={styles.emptyTitle}>No notes yet</Text>
                            <Text style={styles.emptySub}>Notes you capture will appear here, grouped by day.</Text>
                        </View>
                    ) : (
                        groupedByDate.map(([date, dateNotes]) => (
                            <View key={date}>
                                <View style={styles.dateHeaderRow}>
                                    <Text style={styles.dateHeaderText}>{fmtDateLabel(date)}</Text>
                                    <Text style={styles.dateCount}>{dateNotes.length}</Text>
                                </View>
                                {dateNotes.map(note => (
                                    <NoteCard key={note.id} note={note} onConvertToTask={handleConvertToTask} />
                                ))}
                            </View>
                        ))
                    )}
                </ScrollView>
            ) : (
            <FlatList
                data={notes}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
                }
                ListHeaderComponent={
                    <View>
                        {/* Quick note input */}
                        <View style={styles.noteInputCard}>
                            <TextInput
                                style={styles.noteInput}
                                placeholder="Capture a thought..."
                                placeholderTextColor={Colors.textMuted}
                                multiline
                                value={quickNote}
                                onChangeText={setQuickNote}
                                textAlignVertical="top"
                            />
                            <Animated.View style={[styles.savedFlash, { opacity: successAnim }]}>
                                <Text style={styles.savedText}>✓ Saved</Text>
                            </Animated.View>
                            <TouchableOpacity
                                style={[styles.saveNoteBtn, (!quickNote.trim() || saving) && styles.disabledBtn]}
                                onPress={handleSaveNote}
                                disabled={!quickNote.trim() || saving}
                                activeOpacity={0.8}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.saveNoteBtnText}>Save ⚡</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Bodhi Digest */}
                        {notes.length > 0 && (
                            <View style={styles.digestSection}>
                                {!digest ? (
                                    <TouchableOpacity
                                        style={styles.digestBtn}
                                        onPress={loadDigest}
                                        activeOpacity={0.8}
                                    >
                                        {digestLoading ? (
                                            <ActivityIndicator color="#2A9D8F" size="small" />
                                        ) : (
                                            <>
                                                <Text style={styles.digestBtnIcon}>🌿</Text>
                                                <Text style={styles.digestBtnText}>Ask Bodhi to summarise today's notes</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                ) : digest.has_notes && digest.digest ? (
                                    <View style={styles.digestCard}>
                                        <View style={styles.digestHeader}>
                                            <Text style={styles.digestTitle}>🌿 Bodhi's Digest</Text>
                                            <TouchableOpacity onPress={() => setDigest(null)}>
                                                <Text style={styles.digestClose}>✕</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.digestSummary}>{digest.digest.summary}</Text>
                                        {digest.digest.standout_idea ? (
                                            <View style={styles.standoutBox}>
                                                <Text style={styles.standoutLabel}>💡 Standout idea</Text>
                                                <Text style={styles.standoutText}>{digest.digest.standout_idea}</Text>
                                            </View>
                                        ) : null}
                                        {digest.digest.bodhi_message ? (
                                            <Text style={styles.bodhiMsg}>{digest.digest.bodhi_message}</Text>
                                        ) : null}
                                        {digest.digest.suggested_tasks?.length > 0 ? (
                                            <View style={styles.suggestedTasks}>
                                                <Text style={styles.suggestedLabel}>Suggested tasks:</Text>
                                                {digest.digest.suggested_tasks.map((t: string, i: number) => (
                                                    <TouchableOpacity
                                                        key={i}
                                                        style={styles.suggestedTask}
                                                        onPress={async () => {
                                                            try {
                                                                await myspaceApi.createTask({ user_id: userId, title: t });
                                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                            } catch { }
                                                        }}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.suggestedTaskText}>+ {t}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        ) : null}
                                    </View>
                                ) : null}
                            </View>
                        )}

                        {/* Notes header */}
                        {notes.length > 0 && (
                            <Text style={styles.sectionHeader}>Today's notes ({notes.length})</Text>
                        )}

                        {loading && (
                            <View style={styles.centered}>
                                <ActivityIndicator color={Colors.gold} />
                            </View>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>📝</Text>
                            <Text style={styles.emptyTitle}>Nothing captured yet</Text>
                            <Text style={styles.emptySub}>
                                Quick notes, ideas, voice thoughts — capture them here. Bodhi will summarise and surface the best ones.
                            </Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    <NoteCard note={item} onConvertToTask={handleConvertToTask} />
                )}
            />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    segmentWrap: {
        flexDirection: 'row',
        margin: 16,
        marginBottom: 8,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 3,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    segment: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    segmentActive: { backgroundColor: Colors.card },
    segmentTxt: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
    segmentTxtActive: { color: Colors.text, fontWeight: '800' },
    allList: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
    dateHeaderRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 18, marginBottom: 8,
    },
    dateHeaderText: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    dateCount: {
        fontSize: 10, color: Colors.textMuted, backgroundColor: Colors.surface,
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99,
        borderWidth: 1, borderColor: Colors.border, fontWeight: '700',
    },
    centered: { paddingVertical: 40, alignItems: 'center' },
    list: { padding: 16, paddingBottom: 40 },
    noteInputCard: {
        backgroundColor: Colors.card,
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    noteInput: {
        minHeight: 80,
        fontSize: 15,
        color: Colors.text,
        lineHeight: 24,
        marginBottom: 10,
    },
    savedFlash: {
        position: 'absolute',
        top: 14,
        right: 14,
        backgroundColor: '#10B981',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    savedText: { fontSize: 11, color: '#fff', fontWeight: '700' },
    saveNoteBtn: {
        backgroundColor: '#2A9D8F',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
    },
    saveNoteBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    disabledBtn: { opacity: 0.4 },
    digestSection: { marginBottom: 14 },
    digestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#2A9D8F15',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#2A9D8F30',
        justifyContent: 'center',
    },
    digestBtnIcon: { fontSize: 16 },
    digestBtnText: { fontSize: 13, color: '#2A9D8F', fontWeight: '600' },
    digestCard: {
        backgroundColor: Colors.card,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2A9D8F30',
        borderLeftWidth: 3,
        borderLeftColor: '#2A9D8F',
    },
    digestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    digestTitle: { fontSize: 14, fontWeight: '800', color: '#2A9D8F' },
    digestClose: { color: Colors.textMuted, fontSize: 16 },
    digestSummary: { fontSize: 14, color: Colors.text, lineHeight: 22, marginBottom: 10 },
    standoutBox: {
        backgroundColor: Colors.gold + '15',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: Colors.gold + '30',
    },
    standoutLabel: { fontSize: 10, color: Colors.gold, fontWeight: '800', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
    standoutText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
    bodhiMsg: { fontSize: 13, color: Colors.textSub, fontStyle: 'italic', marginBottom: 10 },
    suggestedTasks: { gap: 6 },
    suggestedLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 4, fontWeight: '700', textTransform: 'uppercase' },
    suggestedTask: {
        backgroundColor: Colors.surface,
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    suggestedTaskText: { fontSize: 13, color: '#2A9D8F', fontWeight: '600' },
    sectionHeader: {
        fontSize: 11,
        color: Colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '800',
        marginBottom: 10,
    },
    emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
    emptySub: { fontSize: 13, color: Colors.textSub, textAlign: 'center', lineHeight: 20 },
});
