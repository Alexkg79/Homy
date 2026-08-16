import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorText } from '../../../components/ErrorText';
import { GroupSwitcherHeader } from '../../../components/GroupSwitcherHeader';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { TaskInstanceCard } from '../../../components/TaskInstanceCard';
import { fonts } from '../../../constants/typography';
import { useAuthStore } from '../../../hooks/useAuthStore';
import { useGroupStore } from '../../../hooks/useGroupStore';
import { useTaskStore } from '../../../hooks/useTaskStore';
import { useTheme } from '../../../hooks/useTheme';
import {
  combineDateAndTime,
  formatDaySectionHeader,
  parseDateOnly,
  toDateOnlyString,
} from '../../../lib/datetime';
import { registerForPushNotifications } from '../../../lib/notifications';
import { withPressedOpacity } from '../../../lib/pressedStyle';
import { computeDerivedStatus } from '../../../lib/task-status';
import type { GroupMember, TaskInstance } from '../../../types/database';

/** Rafraîchit le statut/la jauge sans repasser par un fetch réseau. */
const NOW_TICK_MS = 30_000;
const ACTIVE_STATUSES = new Set(['a_faire', 'reportee']);

type SectionKind = 'group' | 'late' | 'today';
interface Section {
  key: string;
  kind: SectionKind;
  title: string;
  data: TaskInstance[];
}

export default function Accueil() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const session = useAuthStore((state) => state.session);
  const groups = useGroupStore((state) => state.groups);
  const membersByGroupId = useGroupStore((state) => state.membersByGroupId);
  const isGroupsLoading = useGroupStore((state) => state.isLoading);
  const hasFetchedGroups = useGroupStore((state) => state.hasFetched);
  const groupError = useGroupStore((state) => state.error);
  const fetchGroups = useGroupStore((state) => state.fetchGroups);

  const tasks = useTaskStore((state) => state.tasks);
  const instances = useTaskStore((state) => state.instances);
  const isTasksLoading = useTaskStore((state) => state.isLoading);
  const tasksError = useTaskStore((state) => state.error);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const completeInstance = useTaskStore((state) => state.completeInstance);
  const refuseInstance = useTaskStore((state) => state.refuseInstance);
  const postponeInstance = useTaskStore((state) => state.postponeInstance);

  const [showDone, setShowDone] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState(new Date());
  const [reportStart, setReportStart] = useState(new Date());
  const [reportDeadline, setReportDeadline] = useState(new Date());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (session && !hasFetchedGroups) {
      fetchGroups(session.user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Demande la permission + enregistre le push token une fois la session
  // disponible (couvre "au lancement" et "après avoir rejoint/créé un
  // groupe" : Accueil est l'écran atteint dans les deux cas). Idempotent
  // (upsert sur `token`), pas besoin de guard supplémentaire.
  useEffect(() => {
    if (session) {
      registerForPushNotifications();
    }
  }, [session]);

  // Refetch à chaque fois que l'écran regagne le focus (pas seulement au
  // montage) : sans ça, créer une tâche depuis task-create.tsx puis revenir
  // en arrière ne rafraîchissait pas la liste tant que l'app n'était pas
  // redémarrée. Ici c'est un refetch de données, pas une navigation, donc
  // pas le piège identifié pour app/index.tsx. Toujours TOUS les groupes
  // (Accueil agrège, contrairement à Tâches/Groupe scopés au groupe actif).
  useFocusEffect(
    useCallback(() => {
      if (groups.length > 0) {
        fetchTasks(groups.map((g) => g.id));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups])
  );

  // Fait vivre le statut dérivé et la jauge de progression sans dépendre
  // d'un re-render déclenché par autre chose.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  // Par groupe et pas à plat : display_name est une colonne par ligne
  // group_members, donc potentiellement différente d'un groupe à l'autre
  // pour une même personne. Un lookup global à plat donnerait le mauvais nom
  // pour les tâches d'un groupe où cette personne a un display_name différent.
  const memberByUserIdPerGroup = useMemo(() => {
    const result: Record<string, Record<string, GroupMember>> = {};
    for (const [groupId, groupMembers] of Object.entries(membersByGroupId)) {
      result[groupId] = Object.fromEntries(groupMembers.map((m) => [m.user_id, m]));
    }
    return result;
  }, [membersByGroupId]);

  const todayStr = useMemo(() => toDateOnlyString(now), [now]);

  // Un bucket late/today/done par groupe (limité à aujourd'hui + tâches en
  // retard des jours précédents, comme avant — pas tout l'historique/futur
  // ici, c'est le rôle de l'onglet Tâches). Le groupe d'une instance se
  // déduit de sa tâche (instance.task_id -> task.group_id), les instances
  // n'ont pas de group_id direct.
  const perGroupBuckets = useMemo(() => {
    const buckets = new Map<
      string,
      { late: TaskInstance[]; today: TaskInstance[]; done: TaskInstance[] }
    >();
    for (const g of groups) {
      buckets.set(g.id, { late: [], today: [], done: [] });
    }

    for (const instance of instances) {
      const task = taskById[instance.task_id];
      const bucket = task ? buckets.get(task.group_id) : undefined;
      if (!bucket) continue;

      if (instance.date === todayStr) {
        if (ACTIVE_STATUSES.has(instance.status)) {
          bucket.today.push(instance);
        } else {
          bucket.done.push(instance);
        }
      } else if (
        instance.date < todayStr &&
        ACTIVE_STATUSES.has(instance.status) &&
        computeDerivedStatus(instance, now) === 'en_retard'
      ) {
        bucket.late.push(instance);
      }
    }

    for (const bucket of buckets.values()) {
      bucket.late.sort(
        (a, b) => a.date.localeCompare(b.date) || a.window_start.localeCompare(b.window_start)
      );
      bucket.today.sort((a, b) => a.window_start.localeCompare(b.window_start));
    }

    return buckets;
  }, [instances, taskById, todayStr, now, groups]);

  // Bloc "Terminées" unique en pied de liste, agrégé sur tous les groupes
  // (pas un accordéon par groupe, pour ne pas fragmenter l'écran).
  const doneToday = useMemo(() => {
    const all: TaskInstance[] = [];
    for (const bucket of perGroupBuckets.values()) {
      all.push(...bucket.done);
    }
    return all.reverse();
  }, [perGroupBuckets]);

  // Header "nom du groupe" affiché seulement à partir de 2 groupes : avec un
  // seul groupe, rendu identique à l'ancien comportement mono-groupe.
  const sections = useMemo(() => {
    const result: Section[] = [];
    const showGroupHeaders = groups.length > 1;

    for (const g of groups) {
      const bucket = perGroupBuckets.get(g.id);
      if (!bucket) continue;

      if (showGroupHeaders) {
        result.push({ key: `group-${g.id}`, kind: 'group', title: g.name, data: [] });
      }
      if (bucket.late.length > 0) {
        result.push({ key: `late-${g.id}`, kind: 'late', title: 'En retard', data: bucket.late });
      }
      result.push({
        key: `today-${g.id}`,
        kind: 'today',
        title: formatDaySectionHeader(todayStr),
        data: bucket.today,
      });
    }

    return result;
  }, [groups, perGroupBuckets, todayStr]);

  if (isGroupsLoading && groups.length === 0) {
    return <LoadingScreen />;
  }

  const startReport = (instance: TaskInstance) => {
    setReportingId(instance.id);
    setReportDate(parseDateOnly(instance.date));
    setReportStart(new Date(instance.window_start));
    setReportDeadline(new Date(instance.deadline));
  };

  const confirmReport = async (instance: TaskInstance) => {
    const success = await postponeInstance(instance.id, {
      date: toDateOnlyString(reportDate),
      windowStart: combineDateAndTime(reportDate, reportStart).toISOString(),
      deadline: combineDateAndTime(reportDate, reportDeadline).toISOString(),
    });
    if (success) {
      setReportingId(null);
    }
  };

  const renderInstance = (item: TaskInstance) => {
    const task = taskById[item.task_id];
    const assignee = task ? memberByUserIdPerGroup[task.group_id]?.[item.assigned_to] : undefined;
    const isAssignee = item.assigned_to === session?.user.id;
    const isActive = ACTIVE_STATUSES.has(item.status);
    const canAct = isAssignee && isActive;
    const isReporting = reportingId === item.id;
    const reportOrderValid =
      combineDateAndTime(reportDate, reportDeadline) >= combineDateAndTime(reportDate, reportStart);

    return (
      <TaskInstanceCard
        key={item.id}
        instance={item}
        task={task}
        assignee={assignee}
        now={now}
        canAct={canAct}
        isReporting={isReporting}
        onComplete={() => completeInstance(item.id)}
        onRefuse={() => refuseInstance(item.id)}
        onStartReport={() => startReport(item)}
        reportForm={
          isReporting
            ? {
                date: reportDate,
                start: reportStart,
                deadline: reportDeadline,
                orderValid: reportOrderValid,
                onChangeDate: setReportDate,
                onChangeStart: setReportStart,
                onChangeDeadline: setReportDeadline,
                onConfirm: () => confirmReport(item),
                onCancel: () => setReportingId(null),
              }
            : undefined
        }
      />
    );
  };

  return (
    <SectionList
      style={[styles.container, { backgroundColor: colors.background }]}
      sections={sections}
      // SectionList est un PureComponent : sans extraData, un item déjà
      // rendu ne se re-rend pas quand seul `now` change (tick périodique),
      // même si son statut dérivé (à venir -> en cours -> en retard)
      // devrait changer. `now` force le re-render de toutes les cards.
      extraData={now}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => {
        if (section.kind === 'group') {
          return (
            <Text style={[styles.groupSectionHeader, { color: colors.textPrimary }]}>
              {section.title}
            </Text>
          );
        }
        return (
          <Text
            style={[
              styles.sectionHeader,
              { color: section.kind === 'late' ? colors.dangerDark : colors.textSectionHeader },
            ]}
          >
            {section.title}
          </Text>
        );
      }}
      renderSectionFooter={({ section }) =>
        section.kind === 'today' && section.data.length === 0 && !isTasksLoading ? (
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
            Aucune tâche aujourd&apos;hui.
          </Text>
        ) : null
      }
      renderItem={({ item }) => renderInstance(item)}
      ListHeaderComponent={
        <View>
          <GroupSwitcherHeader
            paddingTop={insets.top + 16}
            trailing={
              <View style={styles.trailingRow}>
                <Ionicons name="notifications-outline" size={22} color={colors.textMuted} />
                <Pressable
                  style={({ pressed }) => [
                    styles.addBtn,
                    { backgroundColor: colors.accent },
                    withPressedOpacity(pressed),
                  ]}
                  hitSlop={8}
                  onPress={() => router.push('/(app)/task-create')}
                >
                  <Ionicons name="add" size={22} color={colors.accentContrast} />
                </Pressable>
              </View>
            }
          />

          <ErrorText color={colors.danger}>{groupError ?? tasksError}</ErrorText>

          {isTasksLoading && instances.length === 0 && (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Chargement des tâches…
            </Text>
          )}
        </View>
      }
      ListFooterComponent={
        doneToday.length > 0 ? (
          <View style={styles.doneSection}>
            <Pressable
              style={({ pressed }) => [styles.doneToggle, withPressedOpacity(pressed)]}
              onPress={() => setShowDone((s) => !s)}
            >
              <Ionicons
                name={showDone ? 'chevron-down' : 'chevron-forward'}
                size={14}
                color={colors.textMuted}
              />
              <Text style={[styles.doneToggleLabel, { color: colors.textMuted }]}>
                Terminées ({doneToday.length})
              </Text>
            </Pressable>
            {showDone && <View style={styles.doneList}>{doneToday.map(renderInstance)}</View>}
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingBottom: 32,
  },
  trailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
  },
  groupSectionHeader: {
    fontSize: 16,
    fontFamily: fonts.bold,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: fonts.medium,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  doneSection: {
    marginTop: 8,
  },
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneToggleLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  doneList: {
    gap: 0,
  },
});
