import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { FormInput } from '../../components/FormInput';
import { PickerField } from '../../components/PickerField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useGroupStore } from '../../hooks/useGroupStore';
import { useTaskStore } from '../../hooks/useTaskStore';
import { combineDateAndTime, toDateOnlyString } from '../../lib/datetime';
import type { TaskType } from '../../types/database';

const TYPES: { label: string; value: TaskType }[] = [
  { label: 'Ponctuelle', value: 'ponctuelle' },
  { label: 'Récurrente', value: 'recurrente' },
  { label: 'Rotation', value: 'rotation' },
];

// Convention JS Date.getDay() / Postgres extract(dow from ...) : 0 = dimanche.
const DAYS: { label: string; value: number }[] = [
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Jeu', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sam', value: 6 },
  { label: 'Dim', value: 0 },
];

function withTime(hours: number, minutes: number): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function toTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TaskCreate() {
  const group = useGroupStore((state) => state.group);
  const members = useGroupStore((state) => state.members);
  const session = useAuthStore((state) => state.session);
  const createTask = useTaskStore((state) => state.createTask);
  const isSubmitting = useTaskStore((state) => state.isSubmitting);
  const error = useTaskStore((state) => state.error);
  const clearError = useTaskStore((state) => state.clearError);

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [type, setType] = useState<TaskType>('ponctuelle');
  const [assignedTo, setAssignedTo] = useState<string | null>(session?.user.id ?? null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [date, setDate] = useState(new Date());
  const [windowStartTime, setWindowStartTime] = useState(withTime(18, 0));
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [deadlineTime, setDeadlineTime] = useState(withTime(21, 0));

  const toggleDay = (value: number) => {
    setSelectedDays((current) =>
      current.includes(value) ? current.filter((d) => d !== value) : [...current, value]
    );
  };

  const durationValid = /^\d+$/.test(durationMinutes) && Number(durationMinutes) > 0;
  const windowOrderValid =
    type === 'ponctuelle'
      ? combineDateAndTime(date, deadlineTime) >= combineDateAndTime(date, windowStartTime)
      : toTimeString(deadlineTime) >= toTimeString(windowStartTime);

  const canSubmit =
    title.trim().length > 0 &&
    icon.trim().length > 0 &&
    assignedTo !== null &&
    durationValid &&
    windowOrderValid &&
    (type === 'ponctuelle' || selectedDays.length > 0);

  const handleSubmit = async () => {
    if (!group || !assignedTo || !canSubmit) {
      return;
    }
    clearError();

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const success =
      type === 'ponctuelle'
        ? await createTask({
            groupId: group.id,
            title,
            icon,
            type,
            assignedTo,
            recurrenceRule: null,
            date: toDateOnlyString(date),
            windowStart: combineDateAndTime(date, windowStartTime).toISOString(),
            windowDurationMinutes: Number(durationMinutes),
            deadline: combineDateAndTime(date, deadlineTime).toISOString(),
          })
        : await createTask({
            groupId: group.id,
            title,
            icon,
            type,
            assignedTo,
            recurrenceRule: {
              days_of_week: selectedDays,
              window_start_time: toTimeString(windowStartTime),
              window_duration_minutes: Number(durationMinutes),
              deadline_time: toTimeString(deadlineTime),
              timezone,
            },
            date: null,
            windowStart: null,
            windowDurationMinutes: null,
            deadline: null,
          });

    if (success) {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <FormInput
          label="Titre"
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Vaisselle"
        />
        <FormInput
          label="Icône (emoji)"
          value={icon}
          onChangeText={setIcon}
          placeholder="🧹"
          maxLength={4}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.row}>
            {TYPES.map((t) => (
              <Pressable
                key={t.value}
                style={[styles.chip, type === t.value && styles.chipActive]}
                onPress={() => setType(t.value)}
              >
                <Text style={[styles.chipLabel, type === t.value && styles.chipLabelActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Assigné à</Text>
          <View style={styles.row}>
            {members.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.chip, assignedTo === m.user_id && styles.chipActive]}
                onPress={() => setAssignedTo(m.user_id)}
              >
                <Text
                  style={[styles.chipLabel, assignedTo === m.user_id && styles.chipLabelActive]}
                >
                  {m.display_name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {type === 'ponctuelle' ? (
          <PickerField label="Date" value={date} mode="date" onChange={setDate} />
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>Jours de la semaine</Text>
            <View style={styles.row}>
              {DAYS.map((d) => (
                <Pressable
                  key={d.value}
                  style={[styles.chip, selectedDays.includes(d.value) && styles.chipActive]}
                  onPress={() => toggleDay(d.value)}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      selectedDays.includes(d.value) && styles.chipLabelActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <PickerField
          label="Début de fenêtre"
          value={windowStartTime}
          mode="time"
          onChange={setWindowStartTime}
        />
        <FormInput
          label="Durée disponible (minutes)"
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          placeholder="60"
          keyboardType="number-pad"
        />
        <PickerField label="Deadline" value={deadlineTime} mode="time" onChange={setDeadlineTime} />
        {!windowOrderValid && (
          <Text style={styles.hint}>La deadline doit être après le début de la fenêtre.</Text>
        )}

        <ErrorText>{error}</ErrorText>

        <PrimaryButton
          label="Créer la tâche"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!canSubmit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: '#F0F2F5',
  },
  chipActive: {
    backgroundColor: '#2F6FED',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  chipLabelActive: {
    color: '#fff',
  },
  hint: {
    fontSize: 13,
    color: '#D64545',
  },
});
