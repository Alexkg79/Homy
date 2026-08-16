import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { WEEKDAYS } from '../constants/weekdays';
import { useTheme } from '../hooks/useTheme';
import { formatTimeFr, parseTimeString, toTimeOnlyString } from '../lib/datetime';
import type { GroupMember, RecurrenceRule, Task } from '../types/database';
import { FormInput } from './FormInput';
import { PickerField } from './PickerField';
import { TaskIcon } from './TaskIcon';

function daysSummary(daysOfWeek: number[]): string {
  const byValue = new Map(WEEKDAYS.map((d) => [d.value, d.label]));
  return WEEKDAYS.filter((d) => daysOfWeek.includes(d.value))
    .map((d) => byValue.get(d.value))
    .join(', ');
}

interface RecurringTaskEditorProps {
  task: Task;
  members: GroupMember[];
  defaultAssigneeId: string;
  isSubmitting: boolean;
  onSave: (assignedTo: string, recurrenceRule: RecurrenceRule) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

/** Ligne "gérer une tâche récurrente" : résumé + panneau d'édition dépliable. */
export function RecurringTaskEditor({
  task,
  members,
  defaultAssigneeId,
  isSubmitting,
  onSave,
  onDelete,
}: RecurringTaskEditorProps) {
  const { colors } = useTheme();
  const rule = task.recurrence_rule as RecurrenceRule;
  const [expanded, setExpanded] = useState(false);
  const [assignedTo, setAssignedTo] = useState(defaultAssigneeId);
  const [selectedDays, setSelectedDays] = useState<number[]>(rule.days_of_week);
  const [startTime, setStartTime] = useState(() => parseTimeString(rule.window_start_time));
  const [durationMinutes, setDurationMinutes] = useState(String(rule.window_duration_minutes));
  const [deadlineTime, setDeadlineTime] = useState(() => parseTimeString(rule.deadline_time));

  const toggleDay = (value: number) => {
    setSelectedDays((current) =>
      current.includes(value) ? current.filter((d) => d !== value) : [...current, value]
    );
  };

  const durationValid = /^\d+$/.test(durationMinutes) && Number(durationMinutes) > 0;
  const orderValid = toTimeOnlyString(deadlineTime) >= toTimeOnlyString(startTime);
  const canSave = selectedDays.length > 0 && durationValid && orderValid;

  const handleSave = async () => {
    if (!canSave) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const success = await onSave(assignedTo, {
      days_of_week: selectedDays,
      window_start_time: toTimeOnlyString(startTime),
      window_duration_minutes: Number(durationMinutes),
      deadline_time: toTimeOnlyString(deadlineTime),
      timezone,
    });
    if (success) {
      setExpanded(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer la tâche',
      `Supprimer "${task.title}" et toutes ses occurrences ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => onDelete() },
      ]
    );
  };

  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <Pressable style={styles.summaryRow} onPress={() => setExpanded((e) => !e)}>
        <TaskIcon icon={task.icon} size={20} color={colors.textPrimary} />
        <View style={styles.summaryText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{task.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {daysSummary(rule.days_of_week)} · {formatTimeFr(parseTimeString(rule.window_start_time))}
            {' → '}
            {formatTimeFr(parseTimeString(rule.deadline_time))}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded && (
        <View style={[styles.form, { borderTopColor: colors.border }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Assigné à</Text>
            <View style={styles.row}>
              {members.map((m) => (
                <Pressable
                  key={m.id}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.backgroundMuted },
                    assignedTo === m.user_id && { backgroundColor: colors.accent },
                  ]}
                  onPress={() => setAssignedTo(m.user_id)}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: colors.textMuted },
                      assignedTo === m.user_id && { color: colors.accentContrast },
                    ]}
                  >
                    {m.display_name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Jours de la semaine</Text>
            <View style={styles.row}>
              {WEEKDAYS.map((d) => (
                <Pressable
                  key={d.value}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.backgroundMuted },
                    selectedDays.includes(d.value) && { backgroundColor: colors.accent },
                  ]}
                  onPress={() => toggleDay(d.value)}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: colors.textMuted },
                      selectedDays.includes(d.value) && { color: colors.accentContrast },
                    ]}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <PickerField
            label="Début de fenêtre"
            value={startTime}
            mode="time"
            onChange={setStartTime}
            labelColor={colors.textPrimary}
            borderColor={colors.border}
            backgroundColor={colors.inputBackground}
            valueColor={colors.textPrimary}
          />
          <FormInput
            label="Durée disponible (minutes)"
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
            labelColor={colors.textPrimary}
            borderColor={colors.border}
            backgroundColor={colors.inputBackground}
            textColor={colors.textPrimary}
            placeholderColor={colors.placeholder}
          />
          <PickerField
            label="Deadline"
            value={deadlineTime}
            mode="time"
            onChange={setDeadlineTime}
            labelColor={colors.textPrimary}
            borderColor={colors.border}
            backgroundColor={colors.inputBackground}
            valueColor={colors.textPrimary}
          />
          {!orderValid && (
            <Text style={[styles.hint, { color: colors.danger }]}>
              La deadline doit être après le début de la fenêtre.
            </Text>
          )}
          {selectedDays.length === 0 && (
            <Text style={[styles.hint, { color: colors.danger }]}>Sélectionne au moins un jour.</Text>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.accent },
                !canSave && styles.actionBtnDisabled,
              ]}
              disabled={!canSave || isSubmitting}
              onPress={handleSave}
            >
              <Text style={[styles.saveLabel, { color: colors.accentContrast }]}>Enregistrer</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.backgroundMuted }]}
              onPress={handleDelete}
              disabled={isSubmitting}
            >
              <Text style={[styles.actionLabel, { color: colors.danger }]}>Supprimer</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.backgroundMuted }]}
              onPress={() => setExpanded(false)}
            >
              <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Annuler</Text>
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
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  summaryText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  form: {
    padding: 12,
    paddingTop: 0,
    gap: 12,
    borderTopWidth: 0.5,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
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
  saveLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
