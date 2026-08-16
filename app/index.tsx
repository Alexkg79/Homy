import { router } from 'expo-router';
import { useEffect } from 'react';

import { LoadingScreen } from '../components/LoadingScreen';
import { useAuthStore } from '../hooks/useAuthStore';
import { useGroupStore } from '../hooks/useGroupStore';

/**
 * Contrôleur de redirection centralisé (session → groupes → écran). Navigue
 * de façon impérative via useEffect plutôt qu'avec <Redirect> : <Redirect>
 * s'appuie sur useFocusEffect en interne, qui ne se redéclenche que quand cet
 * écran regagne le focus — insuffisant ici, où l'état groupe change pendant
 * qu'on est sur un autre écran (onboarding) et doit déclencher la navigation
 * sans attendre un retour de focus sur "/".
 */
export default function Index() {
  const session = useAuthStore((state) => state.session);
  const groups = useGroupStore((state) => state.groups);
  const isGroupsLoading = useGroupStore((state) => state.isLoading);
  const hasFetched = useGroupStore((state) => state.hasFetched);
  const fetchGroups = useGroupStore((state) => state.fetchGroups);

  useEffect(() => {
    if (!session) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (!hasFetched && !isGroupsLoading) {
      fetchGroups(session.user.id);
      return;
    }

    if (isGroupsLoading || !hasFetched) {
      return;
    }

    router.replace(groups.length > 0 ? '/(app)/(tabs)' : '/(app)/onboarding');
  }, [session, groups, hasFetched, isGroupsLoading, fetchGroups]);

  return <LoadingScreen />;
}
