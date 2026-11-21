import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useSession } from '@/features/session';
import { colors } from '@/features/ui';

function icon(symbol: string) {
  return function TabIcon({ color }: { color: ColorValue }) { return <Text style={{ color, fontSize: 19 }}>{symbol}</Text>; };
}

export default function TabLayout() {
  const { session } = useSession();
  return <Tabs key={session?.role} screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted, sceneStyle: { backgroundColor: colors.paper } }}>
    <Tabs.Screen name="index" options={{ title: 'Katalog', tabBarIcon: icon('▦') }} />
    <Tabs.Screen name="trips" options={{ title: 'Trip', tabBarIcon: icon('⌖') }} />
    <Tabs.Screen name="cart" options={{ title: 'Keranjang', tabBarIcon: icon('▤'), href: session?.role === 'penitip' ? '/cart' : null }} />
    <Tabs.Screen name="orders" options={{ title: 'Pesanan', tabBarIcon: icon('≡') }} />
    <Tabs.Screen name="account" options={{ title: 'Akun', tabBarIcon: icon('◉') }} />
  </Tabs>;
}
