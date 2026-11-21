import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/features/session';
import { colors, Feedback } from '@/features/ui';

function Navigation() {
  const { ready, session } = useSession();
  if (!ready) return <Feedback loading />;
  return <Stack screenOptions={{ headerTintColor: colors.green, headerStyle: { backgroundColor: colors.paper } }}>
    <Stack.Protected guard={!session}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack.Protected>
    <Stack.Protected guard={!!session}>
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack.Protected>
  </Stack>;
}

export default function Layout() {
  return <SessionProvider><StatusBar style="dark" /><Navigation /></SessionProvider>;
}
