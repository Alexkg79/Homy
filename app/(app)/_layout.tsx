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
        presentation: 'modal' seul ne suffit PAS pour une animation slide
        symétrique sur Android : contrairement à iOS, `stackAnimation` sur
        react-native-screens (4.16, vérifié dans Screen.kt/ScreenStack.kt)
        est indépendant de `stackPresentation` et vaut DEFAULT par défaut à
        l'entrée comme à la sortie — d'où la sortie qui "tombe" au lieu de
        glisser. Il faut donc `animation: 'slide_from_bottom'` explicite.
        Ça désynchronise en revanche le header natif du reste de la carte au
        pop (le header disparaît d'un coup) — on désactive donc le header
        natif ici (headerShown: false) et chaque écran dessine son propre
        titre dans son contenu (voir ModalHeader), qui fait alors partie de
        la même vue animée que le reste de la carte.
      */}
      <Stack.Screen
        name="onboarding"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="task-create"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
