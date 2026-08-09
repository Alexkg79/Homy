import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

import type { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// En React Native, le refresh de session ne doit tourner que quand l'app est
// au premier plan, sinon les tentatives de refresh en arrière-plan s'accumulent
// inutilement. https://supabase.com/docs/reference/javascript/initializing?example=react-native-options
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

/**
 * Wrapper typé autour de `supabase.rpc`. @supabase/supabase-js@2.112 ne résout
 * pas correctement `Args`/`Returns` par inférence quand `Database` est écrit à
 * la main (fonctionne avec un fichier généré par `supabase gen types`, mais pas
 * ici) — le cast interne isole ce problème d'outillage à un seul endroit et
 * garde un typage correct côté appelant.
 */
export async function callRpc<FnName extends keyof Database['public']['Functions']>(
  fn: FnName,
  args: Database['public']['Functions'][FnName]['Args']
): Promise<{
  data: Database['public']['Functions'][FnName]['Returns'] | null;
  error: PostgrestError | null;
}> {
  const result = await supabase.rpc(fn as never, args as never);
  return result as never;
}
