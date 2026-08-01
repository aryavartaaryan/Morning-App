import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Font, Spacing } from '@/constants/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: React.ReactNode;
  accent?: string;
}

export function ScreenHeader({ title, subtitle, showBack = false, right, accent }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, accent ? { color: accent } : null]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right && <View style={styles.right}>{right}</View>}
      </View>
      <View style={[styles.divider, accent ? { backgroundColor: accent + '30' } : null]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 56, paddingHorizontal: Spacing.md, backgroundColor: Colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing.sm, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 4, zIndex: 100, elevation: 100 },
  backIcon: { color: Colors.text, fontSize: 18, marginTop: -1 },
  title: { fontSize: Font.sizes.xl, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: Font.sizes.sm, color: Colors.textMuted, marginTop: 2 },
  right: { marginLeft: 'auto' },
  divider: { height: 1, backgroundColor: Colors.border, marginTop: 4 },
});
