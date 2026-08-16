import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorText } from '../../../components/ErrorText';
import { GroupSwitcherHeader } from '../../../components/GroupSwitcherHeader';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { RecurringTaskEditor } from '../../../components/RecurringTaskEditor';
import { TaskInstanceCard } from '../../../components/TaskInstanceCard';
import type { ThemeColors } from '../../../constants/theme';
import { useAuthStore } from '../../../hooks/useAuthStore';
import { useGroupStore } from '../../../hooks/useGroupStore';
import { useTaskStore } from '../../../hooks/useTaskStore';
import { useTheme } from '../../../hooks/useTheme';
import { combineDateAndTime, formatDaySectionHeader, parseDateOnly, toDateOnlyString } from '../../../lib/datetime';
import { computeDerivedStatus, type DerivedInstanceStatus } from '../../../lib/task-status';
import type { RecurrenceRule, TaskInstance, TaskType } from '../../../types/database';

const NOW_TICK_MS = 30_000;

type StatusFilter = 'all' | 'a_faire' | 'terminee' | 'en_retard' | 'refusee' | 'reportee';

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'Toutes', value: 'all' },
  { label: 'À faire', value: 'a_faire' },
  { label: 'Terminée', value: 'terminee' },
  { label: 'En retard', value: 'en_retard' },
  { label: 'Refusée', value: 'refusee' },
  { label: 'Reportée', value: 'reportee' },
];

const TYPE_OPTIONS: { label: string; value: 'all' | TaskType }[] = [
  { label: 'Toutes', value: 'all' },
  { label: 'Ponctuelle', value: 'ponctuelle' },
  { label: 'Récurrente', value: 'recurrente' },
  { label: 'Rotation', value: 'rotation' },
];

function matchesStatusFilter(
  instance: TaskInstance,
  now: Date,
  filter: StatusFilter
): boolean {
  if (filter === 'all') return true;
  const derived: DerivedInstanceStatus = computeDerivedStatus(instance, now);
  if (filter === 'a_faire') {
    return derived === 'a_venir' || derived === 'en_cours' || derived === 'bientot_en_retard';
  }
  return derived === filter;
}

interface FilterRowProps<T extends string> {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  colors: ThemeColors;
}

function FilterRow<T extends string>({ label, options, value, onChange, colors }: FilterRowProps<T>) {
  return (
    <View style={styles.filterRow}>
      <Text style={[styles.filterLabel, { color: colors.textMuted }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterChips}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.filterChip,
                { backgroundColor: colors.backgroundMuted },
                value === opt.value && { backgroundColor: colors.accent },
              ]}
              onPress={() => onChange(opt.value)}
            >
              <Text
                style={[
                  styles.filterChipLabel,
                  { color: colors.textMuted },
                  value === opt.value && { color: colors.accentContrast },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default function Tasks() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const session = useAuthStore((state) => state.session);
  const groups = useGroupStore((state) => state.groups);
  const activeGroupId = useGroupStore((state) => state.activeGroupId);
  const membersByGroupId = useGroupStore((state) => state.membersByGroupId);
  const hasFetchedGroups = useGroupStore((state) => state.hasFetched);
  const fetchGroups = useGroupStore((state) => state.fetchGroups);

  const tasks = useTaskStore((state) => state.tasks);
  const instances = useTaskStore((state) => state.instances);
  const isTasksLoading = useTaskStore((state) => state.isLoading);
  const isTasksSubmitting = useTaskStore((state) => state.isSubmitting);
  const tasksError = useTaskStore((state) => state.error);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);
  const completeInstance = useTaskStore((state) => state.completeInstance);
  const refuseInstance = useTaskStore((state) => state.refuseInstance);
  const postponeInstance = useTaskStore((state) => state.postponeInstance);
  const updateRecurringTask = useTaskStore((state) => state.updateRecurringTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);

  const [showManageRecurring, setShowManageRecurring] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TaskType>('all');

  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState(new Date());
  const [reportStart, setReportStart] = useState(new Date());
  const [reportDeadline, setReportDeadline] = useState(new Date());
  const [now, setNow] = useState(() => new Date());

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

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Scopé au groupe actif : tasks/instances contiennent tous les groupes de
  // l'utilisateur (useTaskStore les fetch ensemble pour Accueil), donc cet
  // onglet ne garde que ceux du groupe actif avant tout le reste.
  const groupTasks = useMemo(
    () => tasks.filter((t) => t.group_id === activeGroupId),
    [tasks, activeGroupId]
  );
  const taskById = useMemo(() => Object.fromEntries(groupTasks.map((t) => [t.id, t])), [groupTasks]);
  const memberByUserId = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members]
  );

  const assignedOptions = useMemo(
    () => [
      { label: 'Tous', value: 'all' },
      ...members.map((m) => ({ label: m.display_name, value: m.user_id })),
    ],
    [members]
  );

  const recurringTasks = useMemo(
    () => groupTasks.filter((t) => t.type !== 'ponctuelle' && t.recurrence_rule !== null),
    [groupTasks]
  );

  const defaultAssigneeByTask = useMemo(() => {
    const result: Record<string, string> = {};
    for (const task of recurringTasks) {
      const relevant = instances
        .filter((i) => i.task_id === task.id)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date));
      result[task.id] = relevant[0]?.assigned_to ?? task.created_by;
    }
    return result;
  }, [recurringTasks, instances]);

  const sections = useMemo(() => {
    const filtered = instances.filter((instance) => {
      const task = taskById[instance.task_id];
      if (!task) return false;
      if (!matchesStatusFilter(instance, now, statusFilter)) return false;
      if (assignedFilter !== 'all' && instance.assigned_to !== assignedFilter) return false;
      if (typeFilter !== 'all' && task.type !== typeFilter) return false;
      return true;
    });

    const byDate = new Map<string, TaskInstance[]>();
    for (const instance of filtered) {
      const bucket = byDate.get(instance.date);
      if (bucket) {
        bucket.push(instance);
      } else {
        byDate.set(instance.date, [instance]);
      }
    }

    return Array.from(byDate.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((date) => ({
        title: formatDaySectionHeader(date),
        data: byDate
          .get(date)!
          .slice()
          .sort((a, b) => a.window_start.localeCompare(b.window_start)),
      }));
  }, [instances, taskById, now, statusFilter, assignedFilter, typeFilter]);

  if (!activeGroupId) {
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
    const isAssignee = item.assigned_to === session?.user.id;
    const isActive = item.status === 'a_faire' || item.status === 'reportee';
    const canAct = isAssignee && isActive;
    const isReporting = reportingId === item.id;
    const reportOrderValid =
      combineDateAndTime(reportDate, reportDeadline) >= combineDateAndTime(reportDate, reportStart);

    return (
      <TaskInstanceCard
        key={item.id}
        instance={item}
        task={taskById[item.task_id]}
        assignee={memberByUserId[item.assigned_to]}
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
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={[styles.sectionHeader, { color: colors.textSectionHeader }]}>{section.title}</Text>
      )}
      renderItem={({ item }) => renderInstance(item)}
      ListHeaderComponent={
        <View>
          <GroupSwitcherHeader paddingTop={insets.top + 16} />

          {recurringTasks.length > 0 && (
            <View style={[styles.manageSection, { borderBottomColor: colors.border }]}>
              <Pressable
                style={styles.manageToggle}
                onPress={() => setShowManageRecurring((s) => !s)}
              >
                <Ionicons
                  name={showManageRecurring ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={colors.accent}
                />
                <Text style={[styles.manageToggleLabel, { color: colors.accent }]}>
                  Gérer les tâches récurrentes ({recurringTasks.length})
                </Text>
              </Pressable>
              {showManageRecurring &&
                recurringTasks.map((task) => (
                  <RecurringTaskEditor
                    key={task.id}
                    task={task}
                    members={members}
                    defaultAssigneeId={defaultAssigneeByTask[task.id] ?? task.created_by}
                    isSubmitting={isTasksSubmitting}
                    onSave={(assignedTo, recurrenceRule: RecurrenceRule) =>
                      updateRecurringTask({ taskId: task.id, assignedTo, recurrenceRule })
                    }
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
            </View>
          )}

          <FilterRow label="Statut" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} colors={colors} />
          <FilterRow label="Assigné" options={assignedOptions} value={assignedFilter} onChange={setAssignedFilter} colors={colors} />
          <FilterRow label="Type" options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} colors={colors} />

          <ErrorText color={colors.danger}>{tasksError}</ErrorText>

          {isTasksLoading && instances.length === 0 && (
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>Chargement des tâches…</Text>
          )}
        </View>
      }
      ListEmptyComponent={
        !isTasksLoading ? (
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
            Aucune tâche ne correspond à ces filtres.
          </Text>
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
  manageSection: {
    borderBottomWidth: 0.5,
    paddingBottom: 8,
  },
  manageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  manageToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterRow: {
    paddingTop: 12,
    gap: 6,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  filterChipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyHint: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
});
