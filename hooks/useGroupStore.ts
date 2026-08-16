import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { callRpc, supabase } from '../lib/supabase';
import type { Group, GroupMember } from '../types/database';

const ACTIVE_GROUP_STORAGE_KEY = 'homy-active-group-id';

interface GroupState {
  groups: Group[];
  activeGroupId: string | null;
  /**
   * Membres de TOUS les groupes de l'utilisateur, indexés par group_id. Pas
   * juste le groupe actif : Accueil affiche les tâches de tous les groupes
   * à la fois et doit résoudre l'assigné de chaque tâche via le groupe
   * auquel ELLE appartient (display_name est une colonne par ligne
   * group_members, donc potentiellement différente d'un groupe à l'autre
   * pour une même personne — un lookup global à plat donnerait le mauvais
   * nom dans ce cas).
   */
  membersByGroupId: Record<string, GroupMember[]>;
  isLoading: boolean;
  hasFetched: boolean;
  isSubmitting: boolean;
  error: string | null;
  fetchGroups: (userId: string) => Promise<void>;
  setActiveGroup: (groupId: string) => void;
  createGroup: (name: string, displayName: string) => Promise<boolean>;
  joinGroup: (code: string, displayName: string) => Promise<boolean>;
  leaveGroup: (userId: string, groupId: string) => Promise<boolean>;
  updateDisplayName: (userId: string, groupId: string, displayName: string) => Promise<boolean>;
  reset: () => void;
  clearError: () => void;
}

async function fetchMembers(groupId: string): Promise<GroupMember[]> {
  const { data } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });
  return data ?? [];
}

/** Regroupe une liste plate de group_members par group_id. */
function groupMembersByGroupId(rows: GroupMember[]): Record<string, GroupMember[]> {
  const result: Record<string, GroupMember[]> = {};
  for (const row of rows) {
    (result[row.group_id] ??= []).push(row);
  }
  return result;
}

async function persistActiveGroupId(groupId: string | null): Promise<void> {
  if (groupId) {
    await AsyncStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, groupId);
  } else {
    await AsyncStorage.removeItem(ACTIVE_GROUP_STORAGE_KEY);
  }
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  activeGroupId: null,
  membersByGroupId: {},
  isLoading: false,
  hasFetched: false,
  isSubmitting: false,
  error: null,

  fetchGroups: async (userId) => {
    set({ isLoading: true, error: null });

    // RLS ("Members can view their groups") restreint déjà `groups` aux
    // groupes de l'utilisateur courant : pas besoin de repasser par
    // group_members pour la liste elle-même, juste pour connaître l'ordre
    // d'adhésion (utilisé comme fallback "premier groupe rejoint").
    const [groupsResult, membershipsResult] = await Promise.all([
      supabase.from('groups').select('*'),
      supabase
        .from('group_members')
        .select('*')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true }),
    ]);

    if (groupsResult.error || membershipsResult.error) {
      set({
        isLoading: false,
        hasFetched: true,
        error:
          groupsResult.error?.message ??
          membershipsResult.error?.message ??
          'Erreur de chargement des groupes.',
      });
      return;
    }

    const joinOrder = new Map((membershipsResult.data ?? []).map((m, i) => [m.group_id, i]));
    const groups = (groupsResult.data ?? [])
      .slice()
      .sort((a, b) => (joinOrder.get(a.id) ?? 0) - (joinOrder.get(b.id) ?? 0));

    const storedActiveId = await AsyncStorage.getItem(ACTIVE_GROUP_STORAGE_KEY);
    const activeGroupId =
      storedActiveId && groups.some((g) => g.id === storedActiveId)
        ? storedActiveId
        : (groups[0]?.id ?? null);
    await persistActiveGroupId(activeGroupId);

    // Un seul aller-retour pour les membres de TOUS les groupes (petits
    // effectifs attendus pour ce type d'app — famille/coloc), plutôt qu'un
    // fetch par groupe à chaque changement de groupe actif.
    const groupIds = groups.map((g) => g.id);
    const membersResult =
      groupIds.length > 0
        ? await supabase.from('group_members').select('*').in('group_id', groupIds)
        : { data: [] as GroupMember[] };
    const membersByGroupId = groupMembersByGroupId(membersResult.data ?? []);

    set({ groups, activeGroupId, membersByGroupId, isLoading: false, hasFetched: true });
  },

  setActiveGroup: (groupId) => {
    if (groupId === get().activeGroupId) return;
    // Purement synchrone : membersByGroupId couvre déjà tous les groupes
    // (chargé par fetchGroups), donc changer de groupe actif n'a besoin
    // d'aucun aller-retour réseau et se perçoit comme instantané.
    set({ activeGroupId: groupId });
    persistActiveGroupId(groupId);
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

    const members = await fetchMembers(data.id);
    set({
      groups: [...get().groups, data],
      membersByGroupId: { ...get().membersByGroupId, [data.id]: members },
    });
    get().setActiveGroup(data.id);
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

    const members = await fetchMembers(data.id);
    set({
      groups: [...get().groups, data],
      membersByGroupId: { ...get().membersByGroupId, [data.id]: members },
    });
    get().setActiveGroup(data.id);
    return true;
  },

  leaveGroup: async (userId, groupId) => {
    set({ isSubmitting: true, error: null });
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('user_id', userId)
      .eq('group_id', groupId);
    set({ isSubmitting: false });

    if (error) {
      set({ error: error.message });
      return false;
    }

    const remainingGroups = get().groups.filter((g) => g.id !== groupId);
    const remainingMembersByGroupId = { ...get().membersByGroupId };
    delete remainingMembersByGroupId[groupId];

    if (get().activeGroupId !== groupId) {
      set({ groups: remainingGroups, membersByGroupId: remainingMembersByGroupId });
      return true;
    }

    // Le groupe actif a été quitté : bascule sur le premier groupe restant
    // (ordre d'adhésion, déjà l'ordre de `groups`), ou null s'il n'en reste
    // aucun.
    const nextActiveId = remainingGroups[0]?.id ?? null;
    await persistActiveGroupId(nextActiveId);

    set({
      groups: remainingGroups,
      membersByGroupId: remainingMembersByGroupId,
      activeGroupId: nextActiveId,
    });
    return true;
  },

  updateDisplayName: async (userId, groupId, displayName) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await supabase
      .from('group_members')
      .update({ display_name: displayName })
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .select()
      .single();
    set({ isSubmitting: false });

    if (error || !data) {
      set({ error: error?.message ?? 'Erreur lors de la mise à jour du nom.' });
      return false;
    }

    const groupMembers = get().membersByGroupId[groupId] ?? [];
    set({
      membersByGroupId: {
        ...get().membersByGroupId,
        [groupId]: groupMembers.map((m) => (m.id === data.id ? data : m)),
      },
    });
    return true;
  },

  reset: () =>
    set({
      groups: [],
      activeGroupId: null,
      membersByGroupId: {},
      isLoading: false,
      hasFetched: false,
      error: null,
    }),

  clearError: () => set({ error: null }),
}));
