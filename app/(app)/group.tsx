import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { LoadingScreen } from '../../components/LoadingScreen';
import { PickerField } from '../../components/PickerField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ProgressBar } from '../../components/ProgressBar';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useGroupStore } from '../../hooks/useGroupStore';
import { useTaskStore } from '../../hooks/useTaskStore';
import {
  combineDateAndTime,
  formatDaySectionHeader,
  formatTimeFr,
  parseDateOnly,
  toDateOnlyString,
} from '../../lib/datetime';
import { registerForPushNotifications } from '../../lib/notifications';
import {
  computeDerivedStatus,
  computeProgressRatio,
  progressColor,
  type DerivedInstanceStatus,
} from '../../lib/task-status';
import type { TaskInstance } from '../../types/database';

/** Rafraîchit le statut/la jauge sans repasser par un fetch réseau. */
const NOW_TICK_MS = 30_000;

const STATUS_LABELS: Record<DerivedInstanceStatus, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  bientot_en_retard: 'Bientôt en retard',
  en_retard: 'En retard',
  terminee: 'Terminée',
  refusee: 'Refusée',
  reportee: 'Reportée',
};

const STATUS_COLORS: Record<DerivedInstanceStatus, string> = {
  a_venir: '#666',
  en_cours: '#2F6FED',
  bientot_en_retard: '#D68A00',
  en_retard: '#D64545',
  terminee: '#2E9E5B',
  refusee: '#999',
  reportee: '#8A5FD6',
};

const ACTIVE_STATUSES = new Set(['a_faire', 'reportee']);

export default function GroupHome() {
  const session = useAuthStore((state) => state.session);
  const group = useGroupStore((state) => state.group);
  const members = useGroupStore((state) => state.members);
  const isGroupLoading = useGroupStore((state) => state.isLoading);
  const hasFetchedGroup = useGroupStore((state) => state.hasFetched);
  const groupError = useGroupStore((state) => state.error);
  const fetchGroup = useGroupStore((state) => state.fetchGroup);

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
    if (session && (!hasFetchedGroup || members.length === 0)) {
      fetchGroup(session.user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Demande la permission + enregistre le push token une fois la session
  // disponible (couvre "au lancement" et "après avoir rejoint/créé un
  // groupe" : group.tsx est l'écran atteint dans les deux cas). Idempotent
  // (upsert sur `token`), pas besoin de guard supplémentaire.
  useEffect(() => {
    if (session) {
      registerForPushNotifications();
    }
  }, [session]);

  // Refetch à chaque fois que l'écran regagne le focus (pas seulement au
  // montage) : sans ça, créer une tâche depuis task-create.tsx puis revenir
  // en arrière ne rafraîchissait pas la liste tant que l'app n'était pas
  // redémarrée (group.tsx reste monté dans la stack, son effet de montage
  // ne se redéclenche pas tout seul). Ici c'est un refetch de données, pas
  // une navigation, donc pas le piège identifié pour app/index.tsx.
  useFocusEffect(
    useCallback(() => {
      if (group) {
        fetchTasks(group.id);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group])
  );

  // Fait vivre le statut dérivé et la jauge de progression sans dépendre
  // d'un re-render déclenché par autre chose. Pas de temps réel à la
  // seconde près : un tick léger suffit (nettoyé au unmount).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const memberByUserId = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members]
  );

  const { activeSections, doneInstances } = useMemo(() => {
    const byDate = new Map<string, TaskInstance[]>();
    const done: TaskInstance[] = [];

    for (const instance of instances) {
      if (ACTIVE_STATUSES.has(instance.status)) {
        const bucket = byDate.get(instance.date);
        if (bucket) {
          bucket.push(instance);
        } else {
          byDate.set(instance.date, [instance]);
        }
      } else {
        done.push(instance);
      }
    }

    // Tri explicite plutôt que de compter sur l'ordre de retour de la requête
    // Supabase + l'ordre d'insertion du Map : jour croissant (aujourd'hui en
    // premier), puis heure de début croissante dans chaque jour.
    const sortedDates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));

    return {
      activeSections: sortedDates.map((date) => ({
        title: formatDaySectionHeader(date),
        data: byDate
          .get(date)!
          .slice()
          .sort((a, b) => a.window_start.localeCompare(b.window_start)),
      })),
      doneInstances: done.slice().reverse(),
    };
  }, [instances]);

  if (!group || (isGroupLoading && members.length === 0)) {
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
    const assignee = memberByUserId[item.assigned_to];
    const derived = computeDerivedStatus(item, now);
    const isAssignee = item.assigned_to === session?.user.id;
    const isActive = ACTIVE_STATUSES.has(item.status);
    const canAct = isAssignee && isActive;
    const isReporting = reportingId === item.id;
    const progressRatio = computeProgressRatio(item, now);
    const reportOrderValid =
      combineDateAndTime(reportDate, reportDeadline) >= combineDateAndTime(reportDate, reportStart);

    return (
      <View key={item.id} style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.icon}>{task?.icon ?? '•'}</Text>
          <View style={styles.rowInfo}>
            <Text style={styles.title}>{task?.title ?? 'Tâche'}</Text>
            <Text style={styles.meta}>
              {formatTimeFr(new Date(item.window_start))} · {assignee?.display_name ?? '—'}
            </Text>
          </View>
          <Text style={[styles.status, { color: STATUS_COLORS[derived] }]}>
            {STATUS_LABELS[derived]}
          </Text>
        </View>

        {isActive && <ProgressBar ratio={progressRatio} color={progressColor(progressRatio)} />}

        {canAct && !isReporting && (
          <View style={styles.actions}>
            <Pressable style={styles.actionBtn} onPress={() => completeInstance(item.id)}>
              <Text style={styles.actionLabel}>Terminer</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => startReport(item)}>
              <Text style={styles.actionLabel}>Reporter</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => refuseInstance(item.id)}>
              <Text style={[styles.actionLabel, styles.refuseLabel]}>Refuser</Text>
            </Pressable>
          </View>
        )}

        {isReporting && (
          <View style={styles.reportForm}>
            <PickerField
              label="Nouvelle date"
              value={reportDate}
              mode="date"
              onChange={setReportDate}
            />
            <PickerField
              label="Nouveau début"
              value={reportStart}
              mode="time"
              onChange={setReportStart}
            />
            <PickerField
              label="Nouvelle deadline"
              value={reportDeadline}
              mode="time"
              onChange={setReportDeadline}
            />
            {!reportOrderValid && (
              <Text style={styles.hint}>La deadline doit être après le début de la fenêtre.</Text>
            )}
            <View style={styles.actions}>
              <Pressable
                style={[styles.actionBtn, !reportOrderValid && styles.actionBtnDisabled]}
                disabled={!reportOrderValid}
                onPress={() => confirmReport(item)}
              >
                <Text style={styles.actionLabel}>Confirmer</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => setReportingId(null)}>
                <Text style={styles.actionLabel}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SectionList
      style={styles.container}
      sections={activeSections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => renderInstance(item)}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.inviteLabel}>Code d&apos;invitation</Text>
            <Text style={styles.inviteCode} selectable>
              {group.invite_code}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <PrimaryButton
              label="Voir les membres"
              variant="secondary"
              style={styles.headerActionBtn}
              onPress={() => router.push('/(app)/members')}
            />
            <PrimaryButton
              label="+ Nouvelle tâche"
              style={styles.headerActionBtn}
              onPress={() => router.push('/(app)/task-create')}
            />
          </View>

          <ErrorText>{groupError ?? tasksError}</ErrorText>

          {isTasksLoading && instances.length === 0 && (
            <Text style={styles.emptyHint}>Chargement des tâches…</Text>
          )}
        </View>
      }
      ListEmptyComponent={
        !isTasksLoading ? <Text style={styles.emptyHint}>Aucune tâche à venir.</Text> : null
      }
      ListFooterComponent={
        doneInstances.length > 0 ? (
          <View style={styles.doneSection}>
            <Pressable style={styles.doneToggle} onPress={() => setShowDone((s) => !s)}>
              <Text style={styles.doneToggleLabel}>
                {showDone ? '▾' : '▸'} Terminées ({doneInstances.length})
              </Text>
            </Pressable>
            {showDone && <View style={styles.doneList}>{doneInstances.map(renderInstance)}</View>}
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  list: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  headerActionBtn: {
    flex: 1,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
  },
  inviteLabel: {
    marginTop: 12,
    fontSize: 13,
    color: '#666',
  },
  inviteCode: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#2F6FED',
  },
  emptyHint: {
    textAlign: 'center',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    marginHorizontal: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F2F5',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 24,
  },
  rowInfo: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: '#666',
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F0F2F5',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2F6FED',
  },
  refuseLabel: {
    color: '#D64545',
  },
  reportForm: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    paddingTop: 10,
  },
  hint: {
    fontSize: 13,
    color: '#D64545',
  },
  doneSection: {
    marginTop: 8,
  },
  doneToggle: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  doneToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  doneList: {
    gap: 12,
  },
});
