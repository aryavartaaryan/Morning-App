import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function EnergyWindowBadge({
    windowName,
    color,
}: {
    windowName?: string;
    color?: string;
}) {
    if (!windowName) return null;
    const c = color ?? '#2A9D8F';
    return (
        <View style={[styles.badge, { backgroundColor: c + '25', borderColor: c + '50' }]}>
            <View style={[styles.dot, { backgroundColor: c }]} />
            <Text style={[styles.text, { color: c }]}>{windowName}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 5,
        borderWidth: 1,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});
