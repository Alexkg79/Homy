import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { create } from 'zustand';

import { mapAuthError } from '../lib/auth-errors';
import { supabase } from '../lib/supabase';
import { useGroupStore } from './useGroupStore';
import { useTaskStore } from './useTaskStore';

interface AuthState {
  session: Session | null;
  isInitialized: boolean;
  isSubmitting: boolean;
  error: string | null;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<'signed_in' | 'confirm_email' | false>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isInitialized: false,
  isSubmitting: false,
  error: null,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, isInitialized: true });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, isInitialized: true });
      if (!session) {
        useGroupStore.getState().reset();
        useTaskStore.getState().reset();
      }
    });

    return () => subscription.subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    set({ isSubmitting: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ isSubmitting: false });
    if (error) {
      set({ error: mapAuthError(error) });
      return false;
    }
    return true;
  },

  signUp: async (email, password) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    set({ isSubmitting: false });

    if (error) {
      set({ error: mapAuthError(error) });
      return false;
    }

    // Email déjà enregistré : Supabase répond sans erreur mais avec une liste
    // d'identités vide, pour ne pas laisser deviner quels emails existent déjà.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      set({ error: 'Un compte existe déjà avec cet email. Essaie de te connecter.' });
      return false;
    }

    if (!data.session) {
      return 'confirm_email';
    }

    return 'signed_in';
  },

  signOut: async () => {
    await supabase.auth.signOut();
    // Navigation impérative : le contrôleur de redirection dans app/index.tsx
    // ne se redéclenche que si cet écran regagne le focus, ce qui n'arrive
    // pas si on déclenche la déconnexion depuis un écran de (app) (ex: le
    // header de group.tsx). On route donc explicitement ici, même logique
    // que dans app/index.tsx.
    router.replace('/(auth)/sign-in');
  },

  clearError: () => set({ error: null }),
}));
