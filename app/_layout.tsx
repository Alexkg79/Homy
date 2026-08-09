import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '../components/LoadingScreen';
import { useAuthStore } from '../hooks/useAuthStore';

export default function RootLayout() {
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    const unsubscribe = useAuthStore.getState().init();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      {isInitialized ? <Stack screenOptions={{ headerShown: false }} /> : <LoadingScreen />}
    </SafeAreaProvider>
  );
}
