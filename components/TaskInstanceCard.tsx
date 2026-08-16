import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { formatRemainingTime, formatTimeFr } from '../lib/datetime';
import {
  computeDerivedStatus,
  computeProgressRatio,
  progressColor,
  type DerivedInstanceStatus,
} from '../lib/task-status';
import type { GroupMember, Task, TaskInstance } from '../types/database';
import { PickerField } from './PickerField';
import { ProgressBar } from './ProgressBar';
import { TaskIcon } from './TaskIcon';

const DONE_LABELS: Partial<Record<DerivedInstanceStatus, string>> = {
  terminee: 'terminée',
  refusee: 'refusée',
  reportee: 'reportée',
};

/** "Alex • il reste 1h32" / "Alex • en retard" / "Alex • terminée", style mockup. */
function buildSubtitle(
  assigneeName: string,
  derived: DerivedInstanceStatus,
  instance: TaskInstance,
  now: Date
): string {
  switch (derived) {
    case 'en_retard':
      return `${assigneeName} • en retard`;
    case 'a_venir':
      return `${assigneeName} • à partir de ${formatTimeFr(new Date(instance.window_start))}`;
    case 'en_cours':
    case 'bientot_en_retard': {
      const remainingMs = new Date(instance.deadline).getTime() - now.getTime();
      return `${assigneeName} • il reste ${formatRemainingTime(remainingMs)}`;
    }
    default:
      return `${assigneeName} • ${DONE_LABELS[derived] ?? derived}`;
  }
}

interface ReportFormValue {
  date: Date;
  start: Date;
  deadline: Date;
  orderValid: boolean;
  onChangeDate: (d: Date) => void;
  onChangeStart: (d: Date) => void;
  onChangeDeadline: (d: Date) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

interface TaskInstanceCardProps {
  instance: TaskInstance;
  task: Task | undefined;
  assignee: GroupMember | undefined;
  now: Date;
  canAct: boolean;
  isReporting: boolean;
  onComplete: () => void;
  onRefuse: () => void;
  onStartReport: () => void;
  reportForm?: ReportFormValue;
}

export function TaskInstanceCard({
  instance,
  task,
  assignee,
  now,
  canAct,
  isReporting,
  onComplete,
  onRefuse,
  onStartReport,
  reportForm,
}: TaskInstanceCardProps) {
  const { colors } = useTheme();
  // Feedback visuel immédiat au tap sur la checkbox : complete_instance fait
  // un aller-retour réseau, donc on affiche la coche remplie tout de suite
  // plutôt que d'attendre la confirmation. Pas de logique de retour arrière
  // en cas d'échec : même comportement qu'avant (le bouton "Terminer" ne
  // gérait pas non plus ce cas), la checkbox appelle juste le même onComplete.
  const [checkedOverride, setCheckedOverride] = useState(false);

  const derived = computeDerivedStatus(instance, now);
  const isLate = derived === 'en_retard';
  const isPending = derived === 'a_venir' || derived === 'en_cours' || derived === 'bientot_en_retard';
  const isDone = derived === 'terminee' || checkedOverride;
  const assigneeName = assignee?.display_name ?? '—';
  const progressRatio = computeProgressRatio(instance, now);

  const handleCheckboxPress = () => {
    if (!canAct) return;
    setCheckedOverride(true);
    onComplete();
  };

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.top}>
        <View style={styles.nameRow}>
          <Pressable
            hitSlop={8}
            disabled={!canAct}
            onPress={handleCheckboxPress}
            style={styles.checkbox}
          >
            <Ionicons
              name={isDone ? 'checkbox' : 'square-outline'}
              size={20}
              color={isDone ? colors.accent : colors.textMuted}
            />
          </Pressable>
          <TaskIcon icon={task?.icon ?? '•'} size={18} color={colors.textPrimary} />
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {task?.title ?? 'Tâche'}
          </Text>
        </View>
        <Text style={[styles.time, { color: colors.textMuted }]}>
          {formatTimeFr(new Date(instance.window_start))}
        </Text>
      </View>

      <Text style={[styles.sub, { color: isLate ? colors.dangerDark : colors.textMuted }]}>
        {buildSubtitle(assigneeName, derived, instance, now)}
      </Text>

      {isPending && <ProgressBar ratio={progressRatio} color={progressColor(progressRatio)} />}
      {isLate && <ProgressBar ratio={1} color={colors.danger} />}

      {canAct && !isReporting && (
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.backgroundMuted }]}
            onPress={onComplete}
          >
            <Text style={[styles.actionLabel, { color: colors.accent }]}>Terminer</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.backgroundMuted }]}
            onPress={onStartReport}
          >
            <Text style={[styles.actionLabel, { color: colors.accent }]}>Reporter</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.backgroundMuted }]}
            onPress={onRefuse}
          >
            <Text style={[styles.actionLabel, { color: colors.danger }]}>Refuser</Text>
          </Pressable>
        </View>
      )}

      {isReporting && reportForm && (
        <View style={[styles.reportForm, { borderTopColor: colors.border }]}>
          <PickerField
            label="Nouvelle date"
            value={reportForm.date}
            mode="date"
            onChange={reportForm.onChangeDate}
            labelColor={colors.textPrimary}
            borderColor={colors.border}
            backgroundColor={colors.inputBackground}
            valueColor={colors.textPrimary}
          />
          <PickerField
            label="Nouveau début"
            value={reportForm.start}
            mode="time"
            onChange={reportForm.onChangeStart}
            labelColor={colors.textPrimary}
            borderColor={colors.border}
            backgroundColor={colors.inputBackground}
            valueColor={colors.textPrimary}
          />
          <PickerField
            label="Nouvelle deadline"
            value={reportForm.deadline}
            mode="time"
            onChange={reportForm.onChangeDeadline}
            labelColor={colors.textPrimary}
            borderColor={colors.border}
            backgroundColor={colors.inputBackground}
            valueColor={colors.textPrimary}
          />
          {!reportForm.orderValid && (
            <Text style={[styles.hint, { color: colors.danger }]}>
              La deadline doit être après le début de la fenêtre.
            </Text>
          )}
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.backgroundMuted },
                !reportForm.orderValid && styles.actionBtnDisabled,
              ]}
              disabled={!reportForm.orderValid}
              onPress={reportForm.onConfirm}
            >
              <Text style={[styles.actionLabel, { color: colors.accent }]}>Confirmer</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.backgroundMuted }]}
              onPress={reportForm.onCancel}
            >
              <Text style={[styles.actionLabel, { color: colors.accent }]}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 0.5,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  checkbox: {
    padding: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  time: {
    fontSize: 12,
  },
  sub: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  reportForm: {
    gap: 10,
    borderTopWidth: 0.5,
    paddingTop: 10,
  },
  hint: {
    fontSize: 12,
  },
});
