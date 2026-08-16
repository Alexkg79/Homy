import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorText } from '../../../components/ErrorText';
import { GroupSwitcherHeader } from '../../../components/GroupSwitcherHeader';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { fonts } from '../../../constants/typography';
import { useAuthStore } from '../../../hooks/useAuthStore';
import { useGroupStore } from '../../../hooks/useGroupStore';
import { useTaskStore } from '../../../hooks/useTaskStore';
import { useTheme } from '../../../hooks/useTheme';
import { computeOnTimeStats } from '../../../lib/stats';
import { withPressedOpacity } from '../../../lib/pressedStyle';
import type { GroupMember } from '../../../types/database';

export default function GroupTab() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const session = useAuthStore((state) => state.session);
  const groups = useGroupStore((state) => state.groups);
  const activeGroupId = useGroupStore((state) => state.activeGroupId);
  const membersByGroupId = useGroupStore((state) => state.membersByGroupId);
  const isGroupsLoading = useGroupStore((state) => state.isLoading);
  const hasFetchedGroups = useGroupStore((state) => state.hasFetched);
  const error = useGroupStore((state) => state.error);
  const fetchGroups = useGroupStore((state) => state.fetchGroups);
  const isLeaving = useGroupStore((state) => state.isSubmitting);
  const leaveGroup = useGroupStore((state) => state.leaveGroup);

  const tasks = useTaskStore((state) => state.tasks);
  const instances = useTaskStore((state) => state.instances);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);

  const group = groups.find((g) => g.id === activeGroupId);
  const members = useMemo(
    () => (activeGroupId ? (membersByGroupId[activeGroupId] ?? []) : []),
    [membersByGroupId, activeGroupId]
  );

  useEffect(() => {
    if (session && !hasFetchedGroups) {
      fetchGroups(session.user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      if (groups.length > 0) {
        fetchTasks(groups.map((g) => g.id));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups])
  );

  if (!group || (isGroupsLoading && groups.length === 0)) {
    return <LoadingScreen />;
  }

  // Stats scopées au groupe actif (contrairement à Profil, qui les affiche
  // globales sur tous les groupes) : instances contient tous les groupes de
  // l'utilisateur, il faut donc filtrer via les tâches de CE groupe.
  const groupTaskIds = new Set(tasks.filter((t) => t.group_id === group.id).map((t) => t.id));
  const groupInstances = instances.filter((i) => groupTaskIds.has(i.task_id));
  const stats = computeOnTimeStats(groupInstances);

  const handleLeave = () => {
    if (!session || !group) return;
    Alert.alert(
      'Quitter le groupe',
      `Quitter "${group.name}" ? Tu pourras rejoindre ou créer un autre groupe ensuite.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            const success = await leaveGroup(session.user.id, group.id);
            if (success && useGroupStore.getState().groups.length === 0) {
              router.replace('/(app)/onboarding');
            }
            // Sinon : le store a déjà basculé sur un autre groupe actif,
            // l'écran se re-rend avec ses données, pas de navigation.
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={members}
        keyExtractor={(item: GroupMember) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <GroupSwitcherHeader paddingTop={insets.top + 24} />

            <View style={styles.inviteBlock}>
              <Text style={[styles.inviteLabel, { color: colors.textMuted }]}>
                Code d&apos;invitation
              </Text>
              <Text style={[styles.inviteCode, { color: colors.accent }]} selectable>
                {group.invite_code}
              </Text>
            </View>

            <View
              style={[
                styles.statsCard,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Text style={[styles.statsTitle, { color: colors.textMuted }]}>Cette semaine</Text>
              <Text style={[styles.statsValue, { color: colors.textPrimary }]}>
                {stats.onTimeRate !== null ? `${Math.round(stats.onTimeRate * 100)}%` : '—'}
              </Text>
              <Text style={[styles.statsHint, { color: colors.textMuted }]}>
                {stats.resolvedCount > 0
                  ? `${stats.onTimeCount}/${stats.resolvedCount} tâches à l'heure`
                  : 'Pas encore de tâche résolue cette semaine.'}
              </Text>
            </View>

            <ErrorText color={colors.danger}>{error}</ErrorText>

            <Text style={[styles.sectionHeader, { color: colors.textSectionHeader }]}>Membres</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.memberRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.backgroundMuted }]}>
              <Text style={[styles.avatarInitial, { color: colors.accent }]}>
                {item.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.memberName, { color: colors.textPrimary }]}>
              {item.display_name}
            </Text>
            {item.user_id === session?.user.id && (
              <Text style={[styles.youTag, { color: colors.textMuted }]}>toi</Text>
            )}
          </View>
        )}
        ListFooterComponent={
          <Pressable
            style={({ pressed }) => [
              styles.leaveBtn,
              { borderColor: colors.danger },
              isLeaving && styles.leaveBtnDisabled,
              withPressedOpacity(pressed),
            ]}
            onPress={handleLeave}
            disabled={isLeaving}
          >
            <Text style={[styles.leaveLabel, { color: colors.danger }]}>Quitter le groupe</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingBottom: 32,
  },
  inviteBlock: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 4,
  },
  inviteLabel: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  inviteCode: {
    fontSize: 22,
    fontFamily: fonts.bold,
    letterSpacing: 4,
  },
  statsCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    borderWidth: 0.5,
    borderRadius: 12,
    alignItems: 'center',
    gap: 2,
  },
  statsTitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  statsValue: {
    fontSize: 32,
    fontFamily: fonts.bold,
  },
  statsHint: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: fonts.medium,
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderBottomWidth: 0.5,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.bold,
  },
  memberName: {
    fontSize: 16,
    fontFamily: fonts.regular,
    flex: 1,
  },
  youTag: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  leaveBtn: {
    marginTop: 24,
    marginHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  leaveBtnDisabled: {
    opacity: 0.5,
  },
  leaveLabel: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
});
