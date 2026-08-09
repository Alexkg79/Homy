import { router } from 'expo-router';
import { useEffect } from 'react';

import { LoadingScreen } from '../components/LoadingScreen';
import { useAuthStore } from '../hooks/useAuthStore';
import { useGroupStore } from '../hooks/useGroupStore';

/**
 * Contrôleur de redirection centralisé (session → groupe → écran). Navigue
 * de façon impérative via useEffect plutôt qu'avec <Redirect> : <Redirect>
 * s'appuie sur useFocusEffect en interne, qui ne se redéclenche que quand cet
 * écran regagne le focus — insuffisant ici, où l'état groupe change pendant
 * qu'on est sur un autre écran (onboarding) et doit déclencher la navigation
 * sans attendre un retour de focus sur "/".
 */
export default function Index() {
  const session = useAuthStore((state) => state.session);
  const group = useGroupStore((state) => state.group);
  const isGroupLoading = useGroupStore((state) => state.isLoading);
  const hasFetched = useGroupStore((state) => state.hasFetched);
  const fetchGroup = useGroupStore((state) => state.fetchGroup);

  useEffect(() => {
    if (!session) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (!hasFetched && !isGroupLoading) {
      fetchGroup(session.user.id);
      return;
    }

    if (isGroupLoading || !hasFetched) {
      return;
    }

    router.replace(group ? '/(app)/group' : '/(app)/onboarding');
  }, [session, group, hasFetched, isGroupLoading, fetchGroup]);

  return <LoadingScreen />;
}
