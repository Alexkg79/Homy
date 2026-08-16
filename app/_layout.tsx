import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '../components/LoadingScreen';
import { useAuthStore } from '../hooks/useAuthStore';
import { useThemeStore } from '../hooks/useThemeStore';

export default function RootLayout() {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    const unsubscribe = useAuthStore.getState().init();
    return unsubscribe;
  }, []);

  useEffect(() => {
    useThemeStore.getState().init();
  }, []);

  const ready = isInitialized && (fontsLoaded || fontError);

  return (
    <SafeAreaProvider>
      {ready ? <Stack screenOptions={{ headerShown: false }} /> : <LoadingScreen />}
    </SafeAreaProvider>
  );
}
