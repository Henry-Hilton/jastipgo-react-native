import { Stack } from 'expo-router';
import { colors } from '@/features/ui';

export default function AppLayout() {
  return <Stack screenOptions={{ headerTintColor: colors.green, headerStyle: { backgroundColor: colors.paper } }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="trip/[id]" options={{ title: 'Detail trip' }} />
    <Stack.Screen name="product/[id]" options={{ title: 'Detail barang' }} />
  </Stack>;
}
