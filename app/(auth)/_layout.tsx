import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg }, animation: 'fade' }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="index" />
      <Stack.Screen name="language" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
