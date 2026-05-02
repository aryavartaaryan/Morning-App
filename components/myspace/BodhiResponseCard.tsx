import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Share } from 'react-native';
import { Colors } from '@/constants/theme';

interface BodhiResponse {
    reflection?: string;
    energy_nudge?: string;
    pattern_insight?: string | null;
    follow_up_prompt?: string;
    daily_insight_quote?: string;
    meditation_tip?: string | null;
    mood_score?: number;
    dominant_emotion?: string;
    stress_detected?: boolean;
}

export default function BodhiResponseCard({
    response,
    onContinueWriting,
    onDone,
}: {
    response: BodhiResponse;
    onContinueWriting: () => void;
    onDone: () => void;
}) {
    const [activeSection, setActiveSection] = useState<'reflection' | 'nudge' | 'pattern'>(
        'reflection'
    );

    const shareInsight = async () => {
        if (!response.daily_insight_quote) return;
        try {
            await Share.share({
                message: `"${response.daily_insight_quote}"\n\n— from my journal on OneSutra`,
            });
        } catch { }
    };

    const tabs = [
        { key: 'reflection' as const, label: 'Reflection' },
        { key: 'nudge' as const, label: 'Energy' },
        { key: 'pattern' as const, label: 'Pattern' },
    ];

    const contentMap = {
        reflection: response.reflection,
        nudge: response.energy_nudge,
        pattern:
            response.pattern_insight ||
            'No recurring pattern detected yet. Keep writing — patterns emerge over time.',
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Bodhi header */}
            <View style={styles.bodhiHeader}>
                <View style={styles.bodhiAvatar}>
                    <Text style={styles.bodhiAvatarIcon}>🌿</Text>
                </View>
                <View>
                    <Text style={styles.bodhiName}>Bodhi</Text>
                    {response.dominant_emotion && (
                        <Text style={styles.bodhiSub}>Sensing: {response.dominant_emotion}</Text>
                    )}
                </View>
                {response.mood_score != null && (
                    <View style={styles.moodBadge}>
                        <Text style={styles.moodScore}>{response.mood_score}/10</Text>
                        <Text style={styles.moodLabel}>mood</Text>
                    </View>
                )}
            </View>

            {/* Section tabs */}
            <View style={styles.sectionTabs}>
                {tabs.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.sectionTab, activeSection === tab.key && styles.activeSectionTab]}
                        onPress={() => setActiveSection(tab.key)}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={[
                                styles.sectionTabText,
                                activeSection === tab.key && styles.activeSectionTabText,
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content card */}
            <View style={styles.responseCard}>
                <Text style={styles.responseText}>{contentMap[activeSection]}</Text>
            </View>

            {/* Follow-up prompt */}
            {response.follow_up_prompt ? (
                <View style={styles.followUpCard}>
                    <Text style={styles.followUpLabel}>Going deeper</Text>
                    <Text style={styles.followUpText}>"{response.follow_up_prompt}"</Text>
                </View>
            ) : null}

            {/* Daily insight quote (shareable) */}
            {response.daily_insight_quote ? (
                <View style={styles.insightCard}>
                    <Text style={styles.insightLabel}>Your insight today</Text>
                    <Text style={styles.insightQuote}>"{response.daily_insight_quote}"</Text>
                    <TouchableOpacity style={styles.shareBtn} onPress={shareInsight} activeOpacity={0.8}>
                        <Text style={styles.shareBtnText}>Share this ↗</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* Action buttons */}
            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.continueBtn} onPress={onContinueWriting} activeOpacity={0.8}>
                    <Text style={styles.continueBtnText}>Write more</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.8}>
                    <Text style={styles.doneBtnText}>Done ✓</Text>
                </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg, padding: 20 },
    bodhiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    bodhiAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2A9D8F',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bodhiAvatarIcon: { fontSize: 20 },
    bodhiName: { fontSize: 16, fontWeight: '700', color: Colors.text },
    bodhiSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
    moodBadge: {
        marginLeft: 'auto',
        backgroundColor: Colors.card,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    moodScore: { fontSize: 16, fontWeight: '800', color: '#2A9D8F' },
    moodLabel: { fontSize: 9, color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    sectionTabs: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: 10,
        padding: 3,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sectionTab: { flex: 1, padding: 9, alignItems: 'center', borderRadius: 8 },
    activeSectionTab: { backgroundColor: Colors.card },
    sectionTabText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
    activeSectionTabText: { color: '#2A9D8F' },
    responseCard: {
        backgroundColor: Colors.card,
        borderRadius: 14,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    responseText: {
        fontSize: 15,
        lineHeight: 24,
        color: Colors.text,
    },
    followUpCard: {
        backgroundColor: '#2A9D8F15',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
        borderLeftWidth: 3,
        borderLeftColor: '#2A9D8F',
        borderWidth: 1,
        borderColor: '#2A9D8F30',
    },
    followUpLabel: {
        fontSize: 9,
        color: '#2A9D8F',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontWeight: '800',
    },
    followUpText: { fontSize: 14, color: Colors.text, lineHeight: 22, fontStyle: 'italic' },
    insightCard: {
        backgroundColor: Colors.cardAlt,
        borderRadius: 14,
        padding: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: Colors.gold + '40',
    },
    insightLabel: {
        fontSize: 9,
        color: Colors.gold,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontWeight: '800',
    },
    insightQuote: {
        fontSize: 15,
        color: Colors.text,
        lineHeight: 24,
        marginBottom: 14,
        fontStyle: 'italic',
    },
    shareBtn: {
        alignSelf: 'flex-start',
        backgroundColor: Colors.gold,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    shareBtnText: { color: Colors.black, fontSize: 12, fontWeight: '700' },
    actionRow: { flexDirection: 'row', gap: 12 },
    continueBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#2A9D8F',
        alignItems: 'center',
    },
    continueBtnText: { color: '#2A9D8F', fontSize: 14, fontWeight: '700' },
    doneBtn: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#2A9D8F',
        alignItems: 'center',
    },
    doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
