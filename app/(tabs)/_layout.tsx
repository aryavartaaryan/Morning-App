import { Tabs, useRouter, usePathname } from 'expo-router';
import { Text, View, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { useRef, useEffect } from 'react';

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtTimer = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

function GlobalPlayerBar() {
  const { playingId, isPaused, sessionSecs, playingMeta, togglePause, stopSound } = useSoundPlayer();
  const slideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: playingId ? 0 : 80,
      useNativeDriver: true,
      speed: 22,
      bounciness: 3,
    }).start();
  }, [!!playingId]);

  if (!playingMeta) return null;

  return (
    <Animated.View style={[GP.wrap, { transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={[playingMeta.top + 'F0', playingMeta.bot + 'F8']}
        style={GP.grad}
      >
        <View style={[GP.liveDot, { backgroundColor: isPaused ? '#555' : playingMeta.color }]} />
        <Text style={{ fontSize: 16 }}>{playingMeta.emoji}</Text>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[GP.name, { color: playingMeta.color }]} numberOfLines={1}>
            {playingMeta.label}
          </Text>
          <Text style={GP.sub}>
            {isPaused ? 'Paused' : fmtTimer(sessionSecs) + ' left'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); togglePause(); }}
          style={GP.btn}
        >
          <Ionicons name={isPaused ? 'play' : 'pause'} size={17} color={playingMeta.color} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); stopSound(true); }}
          style={[GP.btn, { marginLeft: 6, backgroundColor: '#FFFFFF0A' }]}
        >
          <Ionicons name="stop" size={15} color="#FFFFFF40" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const GP = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginBottom: 6,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  grad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  name:    { fontSize: 12, fontWeight: '800', letterSpacing: 0.1 },
  sub:     { fontSize: 10, color: '#FFFFFF50', marginTop: 1 },
  btn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF14', alignItems: 'center', justifyContent: 'center' },
});

const TABS = [
  { name: 'index',    route: '/(tabs)',           iconOn: 'sunny'       as const, icon: 'sunny-outline'       as const, label: 'Daily',    color: '#F5820A' },
  { name: 'alarms',  route: '/(tabs)/alarms',   iconOn: 'alarm'       as const, icon: 'alarm-outline'      as const, label: 'Alarms',   color: '#f97316' },
  { name: 'sleep',   route: '/(tabs)/sleep',    iconOn: 'moon'        as const, icon: 'moon-outline'       as const, label: 'Sleep',    color: '#60a5fa' },
  { name: 'reports', route: '/(tabs)/reports',  iconOn: 'bar-chart'   as const, icon: 'bar-chart-outline'  as const, label: 'Reports',  color: '#10b981' },
  { name: 'settings',route: '/(tabs)/settings', iconOn: 'settings'    as const, icon: 'settings-outline'   as const, label: 'Settings', color: '#a78bfa' },
];

function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 2);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      <GlobalPlayerBar />
      <View style={styles.pill}>
        {TABS.map(tab => {
          const focused = path === '/' ? tab.name === 'index' : path.endsWith(tab.name);
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate(tab.route as never); }}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <View style={[styles.iconWrap, focused && { backgroundColor: tab.color + '22' }]}>
                <Ionicons
                  name={focused ? tab.iconOn : tab.icon}
                  size={23}
                  color={focused ? tab.color : Colors.textMuted}
                />
              </View>
              <Text style={[styles.label, { color: focused ? tab.color : Colors.textMuted, opacity: focused ? 1 : 0.55 }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={() => <CustomTabBar />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="alarms" />
      <Tabs.Screen name="sleep" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.bg,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 16, 24, 0.97)',
    borderRadius: 28,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -2 },
    elevation: 24,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
    lineHeight: 12,
  },
});
