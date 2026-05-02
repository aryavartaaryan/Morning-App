import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { myspaceApi } from '@/lib/myspaceApi';
import JournalEntryComposer from '@/components/myspace/JournalEntryComposer';

const MOOD_COLOR = (score: number) => {
    if (score >= 8) return '#10B981';
    if (score >= 6) return '#F59E0B';
    if (score >= 4) return '#F4A261';
    return '#EF4444';
};

const EMOTION_EMOJI: Record<string, string> = {
    anxious: '😰', hopeful: '🌱', frustrated: '😤', calm: '😌',
    sad: '😢', excited: '⚡', grateful: '🙏', confused: '🌀',
    reflective: '🪞', happy: '😊', tired: '😴', energized: '🔥',
};

export default function JournalTab({
    userId,
    context,
}: {
    userId: string;
    context: any;
}) {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);

    const loadEntries = useCallback(async () => {
        try {
            const data = await myspaceApi.getJournalEntries(userId);
            setEntries(Array.isArray(data) ? data : []);
        } catch {
            setEntries([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    useEffect(() => { loadEntries(); }, [loadEntries]);

    const onRefresh = () => { setRefreshing(true); loadEntries(); };

    const handleSaved = (result: any) => {
        // Prepend new entry to list
        loadEntries();
    };

    if (composerOpen) {
        return (
            <JournalEntryComposer
                userId={userId}
                context={context}
                onSaved={(r) => { handleSaved(r); setComposerOpen(false); }}
                onCancel={() => setComposerOpen(false)}
            />
        );
    }

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={Colors.gold} />
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={Colors.gold}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>📓</Text>
                            <Text style={styles.emptyTitle}>Your journal is empty</Text>
                            <Text style={styles.emptySub}>
                                Start writing — Bodhi will reflect on your entry and surface patterns over time.
                            </Text>
                            <TouchableOpacity
                                style={styles.startBtn}
                                onPress={() => setComposerOpen(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.startBtnText}>Write your first entry ✨</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    ListHeaderComponent={
                        entries.length > 0 ? (
                            <TouchableOpacity
                                style={styles.newEntryBanner}
                                onPress={() => setComposerOpen(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.newEntryText}>+ New entry</Text>
                                <Text style={styles.newEntryMeta}>{context?.energy_window?.name ?? ''}</Text>
                            </TouchableOpacity>
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <View style={styles.entryCard}>
                            {/* Date + mood */}
                            <View style={styles.entryHeader}>
                                <Text style={styles.entryDate}>
                                    {item.entryDate
                                        ? new Date(item.entryDate).toLocaleDateString('en-IN', {
                                            weekday: 'short', day: 'numeric', month: 'short',
                                          })
                                        : ''}
                                </Text>
                                <View style={styles.entryMeta}>
                                    {item.dominantEmotion ? (
                                        <Text style={styles.emotionEmoji}>
                                            {EMOTION_EMOJI[item.dominantEmotion] ?? '🌀'}
                                        </Text>
                                    ) : null}
                                    {item.moodScore != null ? (
                                        <View style={[styles.moodBadge, { backgroundColor: MOOD_COLOR(item.moodScore) + '33' }]}>
                                            <Text style={[styles.moodScore, { color: MOOD_COLOR(item.moodScore) }]}>
                                                {item.moodScore}/10
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            </View>

                            {/* Energy window */}
                            {item.energyWindow ? (
                                <Text style={styles.energyWindow}>⚡ {item.energyWindow}</Text>
                            ) : null}

                            {/* Content preview */}
                            <Text style={styles.entryContent} numberOfLines={3}>
                                {item.content}
                            </Text>

                            {/* Daily insight quote */}
                            {item.dailyInsightQuote ? (
                                <View style={styles.quoteBox}>
                                    <Text style={styles.quoteText}>"{item.dailyInsightQuote}"</Text>
                                </View>
                            ) : null}

                            {/* Tags */}
                            {item.themeTags && item.themeTags.length > 0 ? (
                                <View style={styles.tagsRow}>
                                    {item.themeTags.slice(0, 3).map((tag: string) => (
                                        <View key={tag} style={styles.tag}>
                                            <Text style={styles.tagText}>{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 16, paddingBottom: 40 },
    newEntryBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#2A9D8F20',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#2A9D8F40',
    },
    newEntryText: { fontSize: 14, fontWeight: '700', color: '#2A9D8F' },
    newEntryMeta: { fontSize: 11, color: '#2A9D8FAA' },
    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 28 },
    emptyEmoji: { fontSize: 52, marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 10 },
    emptySub: {
        fontSize: 14,
        color: Colors.textSub,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    startBtn: {
        backgroundColor: '#2A9D8F',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
    },
    startBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    entryCard: {
        backgroundColor: Colors.card,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    entryDate: { fontSize: 12, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    emotionEmoji: { fontSize: 18 },
    moodBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    moodScore: { fontSize: 12, fontWeight: '800' },
    energyWindow: { fontSize: 10, color: Colors.textMuted, marginBottom: 8, letterSpacing: 0.3 },
    entryContent: { fontSize: 14, color: Colors.textSub, lineHeight: 22, marginBottom: 10 },
    quoteBox: {
        backgroundColor: Colors.surface,
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        borderLeftWidth: 2,
        borderLeftColor: Colors.gold,
    },
    quoteText: { fontSize: 13, color: Colors.text, fontStyle: 'italic', lineHeight: 20 },
    tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    tag: {
        backgroundColor: Colors.surface,
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    tagText: { fontSize: 10, color: Colors.textSub },
});
