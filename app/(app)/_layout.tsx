import { Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useAuthStore } from '../../hooks/useAuthStore';

export default function AppLayout() {
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <Stack
      screenOptions={{
        title: 'Homy',
        headerRight: () => (
          <Pressable onPress={signOut} hitSlop={12}>
            <Text style={{ color: '#2F6FED', fontSize: 15 }}>Déconnexion</Text>
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="onboarding" options={{ title: 'Rejoindre un groupe' }} />
      <Stack.Screen name="group" options={{ title: 'Mon groupe' }} />
      <Stack.Screen name="task-create" options={{ title: 'Nouvelle tâche' }} />
      <Stack.Screen name="members" options={{ title: 'Membres', presentation: 'modal' }} />
    </Stack>
  );
}
