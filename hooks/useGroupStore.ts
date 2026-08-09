import { create } from 'zustand';

import { callRpc, supabase } from '../lib/supabase';
import type { Group, GroupMember } from '../types/database';

interface GroupState {
  group: Group | null;
  members: GroupMember[];
  isLoading: boolean;
  hasFetched: boolean;
  isSubmitting: boolean;
  error: string | null;
  fetchGroup: (userId: string) => Promise<void>;
  createGroup: (name: string, displayName: string) => Promise<boolean>;
  joinGroup: (code: string, displayName: string) => Promise<boolean>;
  reset: () => void;
  clearError: () => void;
}

export const useGroupStore = create<GroupState>((set) => ({
  group: null,
  members: [],
  isLoading: false,
  hasFetched: false,
  isSubmitting: false,
  error: null,

  fetchGroup: async (userId) => {
    set({ isLoading: true, error: null });

    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) {
      set({ isLoading: false, hasFetched: true, error: membershipError.message });
      return;
    }

    if (!membership) {
      set({ group: null, members: [], isLoading: false, hasFetched: true });
      return;
    }

    const [groupResult, membersResult] = await Promise.all([
      supabase.from('groups').select('*').eq('id', membership.group_id).single(),
      supabase
        .from('group_members')
        .select('*')
        .eq('group_id', membership.group_id)
        .order('joined_at', { ascending: true }),
    ]);

    if (groupResult.error || membersResult.error) {
      set({
        isLoading: false,
        hasFetched: true,
        error:
          groupResult.error?.message ??
          membersResult.error?.message ??
          'Erreur de chargement du groupe.',
      });
      return;
    }

    set({
      group: groupResult.data,
      members: membersResult.data ?? [],
      isLoading: false,
      hasFetched: true,
    });
  },

  createGroup: async (name, displayName) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await callRpc('create_group', {
      group_name: name,
      member_display_name: displayName,
    });
    set({ isSubmitting: false });

    if (error || !data) {
      set({ error: error?.message ?? 'Erreur lors de la création du groupe.' });
      return false;
    }

    set({ group: data, members: [], hasFetched: false });
    return true;
  },

  joinGroup: async (code, displayName) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await callRpc('join_group', {
      code,
      member_display_name: displayName,
    });
    set({ isSubmitting: false });

    if (error || !data) {
      set({ error: error?.message ?? 'Erreur lors de la connexion au groupe.' });
      return false;
    }

    set({ group: data, members: [], hasFetched: false });
    return true;
  },

  reset: () => set({ group: null, members: [], isLoading: false, hasFetched: false, error: null }),

  clearError: () => set({ error: null }),
}));
