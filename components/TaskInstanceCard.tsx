import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts } from '../constants/typography';
import { useTheme } from '../hooks/useTheme';
import { formatRemainingTime, formatTimeFr } from '../lib/datetime';
import { withPressedOpacity } from '../lib/pressedStyle';
import {
  computeDerivedStatus,
  computeProgressRatio,
  progressColor,
  type DerivedInstanceStatus,
} from '../lib/task-status';
import type { GroupMember, Task, TaskInstance } from '../types/database';
import { ActionButton } from './ActionButton';
import { ConfirmModal } from './ConfirmModal';
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
  // Feedback visuel optimiste sur la checkbox : complete_instance fait un
  // aller-retour réseau, donc on affiche la coche remplie tout de suite après
  // confirmation plutôt que d'attendre la réponse. Pas de logique de retour
  // arrière en cas d'échec, comme avant. Le tap initial (checkbox ou bouton
  // "Terminer") ne fait qu'ouvrir la ConfirmModal — l'action réelle (et
  // l'override visuel) n'arrive qu'au tap sur "Confirmer" dans la modale.
  const [checkedOverride, setCheckedOverride] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [refuseConfirmVisible, setRefuseConfirmVisible] = useState(false);

  const derived = computeDerivedStatus(instance, now);
  const isLate = derived === 'en_retard';
  const isPending = derived === 'a_venir' || derived === 'en_cours' || derived === 'bientot_en_retard';
  const isDone = derived === 'terminee' || checkedOverride;
  const assigneeName = assignee?.display_name ?? '—';
  const progressRatio = computeProgressRatio(instance, now);

  // Scale + fade uniquement sur la transition déclenchée par l'utilisateur
  // (checkedOverride) : une tâche déjà "terminee" au montage (rechargée
  // depuis le serveur) s'affiche cochée directement, sans rejouer l'anim.
  const checkAnim = useRef(new Animated.Value(isDone ? 1 : 0)).current;

  useEffect(() => {
    if (checkedOverride) {
      checkAnim.setValue(0);
      Animated.timing(checkAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedOverride]);

  const openConfirm = () => setConfirmVisible(true);

  const handleConfirmComplete = () => {
    setConfirmVisible(false);
    setCheckedOverride(true);
    onComplete();
  };

  const handleCheckboxPress = () => {
    if (!canAct) return;
    openConfirm();
  };

  const openRefuseConfirm = () => setRefuseConfirmVisible(true);
  const handleConfirmRefuse = () => {
    setRefuseConfirmVisible(false);
    onRefuse();
  };

  const isUrgent = task?.priority === 'urgente';

  return (
    <View
      style={[
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.card },
        isUrgent && { borderLeftWidth: 3, borderLeftColor: colors.danger },
      ]}
    >
      <View style={styles.top}>
        <View style={styles.nameRow}>
          <Pressable
            hitSlop={8}
            disabled={!canAct}
            onPress={handleCheckboxPress}
            style={({ pressed }) => [styles.checkbox, withPressedOpacity(pressed)]}
          >
            {isDone ? (
              <Animated.View
                style={{ opacity: checkAnim, transform: [{ scale: checkAnim }] }}
              >
                <Ionicons name="checkbox" size={20} color={colors.accent} />
              </Animated.View>
            ) : (
              <Ionicons name="square-outline" size={20} color={colors.textMuted} />
            )}
          </Pressable>
          <TaskIcon icon={task?.icon ?? '•'} size={18} color={colors.textPrimary} />
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {task?.title ?? 'Tâche'}
          </Text>
          {isUrgent && (
            <View style={[styles.urgentBadge, { backgroundColor: colors.dangerMuted }]}>
              <Text style={[styles.urgentBadgeLabel, { color: colors.danger }]}>URGENT</Text>
            </View>
          )}
        </View>
        <Text style={[styles.time, { color: colors.textMuted }]}>
          {formatTimeFr(new Date(instance.window_start))}
        </Text>
      </View>

      <Text style={[styles.sub, { color: isLate ? colors.dangerDark : colors.textMuted }]}>
        {buildSubtitle(assigneeName, derived, instance, now)}
      </Text>

      {isPending && (
        <ProgressBar
          ratio={progressRatio}
          color={progressColor(progressRatio)}
          pulse={derived === 'bientot_en_retard'}
        />
      )}
      {isLate && <ProgressBar ratio={1} color={colors.danger} />}

      {canAct && !isReporting && (
        <View style={styles.actions}>
          <ActionButton
            label="Terminer"
            icon="checkmark-circle"
            variant="filled"
            onPress={openConfirm}
            colors={colors}
          />
          <ActionButton
            label="Reporter"
            icon="time-outline"
            variant="outline"
            onPress={onStartReport}
            colors={colors}
          />
          <ActionButton
            label="Refuser"
            icon="close-circle"
            variant="soft-danger"
            onPress={openRefuseConfirm}
            colors={colors}
          />
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
            <ActionButton
              label="Confirmer"
              icon="checkmark-circle"
              variant="filled"
              onPress={reportForm.onConfirm}
              disabled={!reportForm.orderValid}
              colors={colors}
            />
            <ActionButton
              label="Annuler"
              icon="close-outline"
              variant="outline"
              onPress={reportForm.onCancel}
              colors={colors}
            />
          </View>
        </View>
      )}

      <ConfirmModal
        visible={confirmVisible}
        title="Terminer cette tâche ?"
        message={task?.title}
        onConfirm={handleConfirmComplete}
        onCancel={() => setConfirmVisible(false)}
      />
      <ConfirmModal
        visible={refuseConfirmVisible}
        title="Refuser cette tâche ?"
        message={task?.title}
        confirmLabel="Refuser"
        confirmIcon="close-circle"
        confirmVariant="soft-danger"
        onConfirm={handleConfirmRefuse}
        onCancel={() => setRefuseConfirmVisible(false)}
      />
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
    fontFamily: fonts.medium,
    flexShrink: 1,
  },
  urgentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentBadgeLabel: {
    fontSize: 9,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  time: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  sub: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  reportForm: {
    gap: 10,
    borderTopWidth: 0.5,
    paddingTop: 10,
  },
  hint: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
});
