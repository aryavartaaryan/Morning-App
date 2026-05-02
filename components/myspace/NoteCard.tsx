import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

const NOTE_TYPE_ICON: Record<string, string> = {
    quick: '⚡',
    idea: '💡',
    voice: '🎙️',
    image: '🖼️',
};

interface NoteCardProps {
    note: {
        id: string;
        content?: string;
        note_type?: string;
        created_at?: string;
        voice_transcript?: string;
        extracted_action?: string;
        ai_tags?: string[];
    };
    onConvertToTask?: (note: NoteCardProps['note']) => void;
}

export default function NoteCard({ note, onConvertToTask }: NoteCardProps) {
    const text = note.content || note.voice_transcript || '';
    const icon = NOTE_TYPE_ICON[note.note_type ?? 'quick'] ?? '📝';
    const time = note.created_at
        ? new Date(note.created_at).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        })
        : '';

    return (
        <View style={styles.card}>
            <View style={styles.topRow}>
                <Text style={styles.icon}>{icon}</Text>
                <Text style={styles.time}>{time}</Text>
            </View>

            <Text style={styles.content} numberOfLines={4}>
                {text}
            </Text>

            {note.extracted_action ? (
                <View style={styles.actionPill}>
                    <Text style={styles.actionText}>→ {note.extracted_action}</Text>
                </View>
            ) : null}

            {note.ai_tags && note.ai_tags.length > 0 ? (
                <View style={styles.tagsRow}>
                    {note.ai_tags.slice(0, 3).map(tag => (
                        <View key={tag} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {onConvertToTask ? (
                <TouchableOpacity
                    style={styles.convertBtn}
                    onPress={() => onConvertToTask(note)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.convertBtnText}>+ Make it a task</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    icon: { fontSize: 16, marginRight: 8 },
    time: { fontSize: 11, color: Colors.textMuted, marginLeft: 'auto' },
    content: { fontSize: 14, color: Colors.text, lineHeight: 22 },
    actionPill: {
        marginTop: 8,
        backgroundColor: '#2A9D8F20',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: '#2A9D8F40',
    },
    actionText: { fontSize: 12, color: '#2A9D8F', fontWeight: '600' },
    tagsRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
    tag: {
        backgroundColor: Colors.surface,
        borderRadius: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    tagText: { fontSize: 10, color: Colors.textSub },
    convertBtn: {
        marginTop: 10,
        alignSelf: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.gold + '60',
        backgroundColor: Colors.gold + '15',
    },
    convertBtnText: { fontSize: 12, color: Colors.gold, fontWeight: '700' },
});
