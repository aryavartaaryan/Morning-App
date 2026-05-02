import { Tabs, useRouter, usePathname } from 'expo-router';
import { Text, View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

const TABS = [
  { name: 'index',    route: '/(tabs)',          iconOn: 'alarm'       as const, icon: 'alarm-outline'      as const, label: 'Alarm',    color: '#F5820A' },
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
