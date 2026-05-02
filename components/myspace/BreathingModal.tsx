import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Modal,
} from 'react-native';
import { Colors } from '@/constants/theme';

export default function BreathingModal({
    tip,
    onClose,
}: {
    tip: string;
    onClose: () => void;
}) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
    const [round, setRound] = useState(1);

    useEffect(() => {
        // Fade in
        Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();

        // 4-7-8 breathing: 3 rounds
        const runCycle = (roundNum: number) => {
            if (roundNum > 3) return;
            setRound(roundNum);

            // Inhale 4s
            setPhase('inhale');
            Animated.timing(scaleAnim, {
                toValue: 1.65,
                duration: 4000,
                useNativeDriver: true,
            }).start(() => {
                // Hold 7s
                setPhase('hold');
                setTimeout(() => {
                    // Exhale 8s
                    setPhase('exhale');
                    Animated.timing(scaleAnim, {
                        toValue: 1.0,
                        duration: 8000,
                        useNativeDriver: true,
                    }).start(() => {
                        setTimeout(() => runCycle(roundNum + 1), 500);
                    });
                }, 7000);
            });
        };

        runCycle(1);
    }, []);

    const phaseLabel: Record<string, string> = {
        inhale: 'Breathe in',
        hold: 'Hold',
        exhale: 'Breathe out',
    };
    const phaseColor: Record<string, string> = {
        inhale: '#2A9D8F',
        hold: '#E9C46A',
        exhale: '#457B9D',
    };
    const phaseSecs: Record<string, string> = { inhale: '4s', hold: '7s', exhale: '8s' };

    const c = phaseColor[phase];

    return (
        <Modal transparent animationType="fade" statusBarTranslucent>
            <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
                <View style={styles.container}>
                    {/* Header */}
                    <Text style={styles.headerLabel}>4 · 7 · 8 Breathing</Text>
                    <Text style={styles.tipText}>{tip}</Text>

                    {/* Round indicator */}
                    <View style={styles.roundRow}>
                        {[1, 2, 3].map(r => (
                            <View
                                key={r}
                                style={[styles.roundDot, { backgroundColor: r <= round ? c : Colors.border }]}
                            />
                        ))}
                    </View>

                    {/* Animating circle */}
                    <View style={styles.circleWrap}>
                        <Animated.View
                            style={[
                                styles.outerCircle,
                                { borderColor: c + '50', transform: [{ scale: scaleAnim }] },
                            ]}
                        />
                        <View style={[styles.innerCircle, { backgroundColor: c + '30', borderColor: c }]}>
                            <Text style={[styles.phaseEmoji]}>
                                {phase === 'inhale' ? '🌬️' : phase === 'hold' ? '⏸️' : '😮‍💨'}
                            </Text>
                            <Text style={[styles.phaseLabel, { color: c }]}>{phaseLabel[phase]}</Text>
                            <Text style={[styles.phaseSecs, { color: c + 'AA' }]}>{phaseSecs[phase]}</Text>
                        </View>
                    </View>

                    <Text style={styles.instruction}>Follow the circle · Round {round} of 3</Text>

                    <TouchableOpacity style={[styles.closeBtn, { borderColor: c }]} onPress={onClose} activeOpacity={0.8}>
                        <Text style={[styles.closeBtnText, { color: c }]}>I feel better ✓</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(4,4,10,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '88%',
        borderRadius: 24,
        backgroundColor: Colors.card,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.textMuted,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    tipText: {
        color: Colors.textSub,
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
        paddingHorizontal: 8,
    },
    roundRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 28,
    },
    roundDot: { width: 8, height: 8, borderRadius: 4 },
    circleWrap: { width: 180, height: 180, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
    outerCircle: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 2,
    },
    innerCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
    },
    phaseEmoji: { fontSize: 22, marginBottom: 4 },
    phaseLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
    phaseSecs: { fontSize: 10, marginTop: 2 },
    instruction: {
        color: Colors.textMuted,
        fontSize: 12,
        marginBottom: 24,
        letterSpacing: 0.3,
    },
    closeBtn: {
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1.5,
    },
    closeBtnText: { fontSize: 14, fontWeight: '700' },
});
