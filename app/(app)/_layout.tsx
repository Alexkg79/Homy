import { Stack } from 'expo-router';

import { useTheme } from '../../hooks/useTheme';

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'Homy',
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { color: colors.textPrimary },
      }}
    >
      {/*
        presentation: 'modal' seul (sans `animation` explicite) : la
        transition modale native (slide-up géré nativement par
        react-native-screens, header inclus) est déjà symétrique à l'entrée
        et à la sortie sur iOS et Android. Ajouter `animation:
        'slide_from_bottom'` par-dessus désynchronise le header du reste de
        la carte au moment du pop (goBack) — le header disparaît d'un coup
        au lieu de glisser avec le contenu — donc on laisse la présentation
        modale seule piloter toute la transition.
      */}
      <Stack.Screen
        name="onboarding"
        options={{ title: 'Rejoindre un groupe', presentation: 'modal' }}
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="task-create"
        options={{ title: 'Nouvelle tâche', presentation: 'modal' }}
      />
    </Stack>
  );
}
