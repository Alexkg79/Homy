import { create } from 'zustand';

import { callRpc, supabase } from '../lib/supabase';
import type { RecurrenceRule, Task, TaskInstance, TaskType } from '../types/database';

interface CreateTaskParams {
  groupId: string;
  title: string;
  icon: string;
  type: TaskType;
  assignedTo: string;
  recurrenceRule: RecurrenceRule | null;
  date: string | null;
  windowStart: string | null;
  windowDurationMinutes: number | null;
  deadline: string | null;
}

interface PostponeParams {
  date: string;
  windowStart: string;
  deadline: string;
}

interface UpdateRecurringTaskParams {
  taskId: string;
  // null = ne pas modifier ce champ (même sémantique que les paramètres par
  // défaut de la RPC update_recurring_task).
  assignedTo: string | null;
  recurrenceRule: RecurrenceRule | null;
}

interface TaskState {
  tasks: Task[];
  instances: TaskInstance[];
  isLoading: boolean;
  hasFetched: boolean;
  isSubmitting: boolean;
  error: string | null;
  fetchTasks: (groupIds: string[]) => Promise<void>;
  createTask: (params: CreateTaskParams) => Promise<boolean>;
  completeInstance: (instanceId: string) => Promise<boolean>;
  refuseInstance: (instanceId: string) => Promise<boolean>;
  postponeInstance: (instanceId: string, params: PostponeParams) => Promise<boolean>;
  updateRecurringTask: (params: UpdateRecurringTaskParams) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  reset: () => void;
  clearError: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  instances: [],
  isLoading: false,
  hasFetched: false,
  isSubmitting: false,
  error: null,

  fetchTasks: async (groupIds) => {
    set({ isLoading: true, error: null });

    if (groupIds.length === 0) {
      set({ tasks: [], instances: [], isLoading: false, hasFetched: true });
      return;
    }

    // Best-effort : régénère les occurrences manquantes des tâches
    // récurrentes avant de lire la liste. Pas bloquant si ça échoue, la
    // liste se contente alors des instances déjà existantes.
    await callRpc('refresh_recurring_instances', {});

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false });

    if (tasksError) {
      set({ isLoading: false, hasFetched: true, error: tasksError.message });
      return;
    }

    const taskIds = (tasks ?? []).map((t) => t.id);
    let instances: TaskInstance[] = [];

    if (taskIds.length > 0) {
      const { data, error: instancesError } = await supabase
        .from('task_instances')
        .select('*')
        .in('task_id', taskIds)
        .order('date', { ascending: true })
        .order('window_start', { ascending: true });

      if (instancesError) {
        set({ isLoading: false, hasFetched: true, error: instancesError.message });
        return;
      }
      instances = data ?? [];
    }

    set({ tasks: tasks ?? [], instances, isLoading: false, hasFetched: true });
  },

  createTask: async (params) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await callRpc('create_task', {
      p_group_id: params.groupId,
      p_title: params.title,
      p_icon: params.icon,
      p_type: params.type,
      p_assigned_to: params.assignedTo,
      p_recurrence_rule: params.recurrenceRule,
      p_date: params.date,
      p_window_start: params.windowStart,
      p_window_duration_minutes: params.windowDurationMinutes,
      p_deadline: params.deadline,
    });
    set({ isSubmitting: false });

    if (error || !data) {
      set({ error: error?.message ?? 'Erreur lors de la création de la tâche.' });
      return false;
    }

    // hasFetched: false force le prochain écran liste à refetch (create_task
    // ne renvoie que la tâche, pas les instances générées avec).
    set({ tasks: [data, ...get().tasks], hasFetched: false });
    return true;
  },

  completeInstance: async (instanceId) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await supabase
      .from('task_instances')
      .update({ status: 'terminee' })
      .eq('id', instanceId)
      .select()
      .single();
    set({ isSubmitting: false });

    if (error || !data) {
      set({ error: error?.message ?? 'Erreur lors de la validation de la tâche.' });
      return false;
    }

    set({ instances: get().instances.map((i) => (i.id === instanceId ? data : i)) });
    return true;
  },

  refuseInstance: async (instanceId) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await supabase
      .from('task_instances')
      .update({ status: 'refusee' })
      .eq('id', instanceId)
      .select()
      .single();
    set({ isSubmitting: false });

    if (error || !data) {
      set({ error: error?.message ?? 'Erreur lors du refus de la tâche.' });
      return false;
    }

    set({ instances: get().instances.map((i) => (i.id === instanceId ? data : i)) });
    return true;
  },

  postponeInstance: async (instanceId, params) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await supabase
      .from('task_instances')
      .update({
        status: 'reportee',
        date: params.date,
        window_start: params.windowStart,
        deadline: params.deadline,
      })
      .eq('id', instanceId)
      .select()
      .single();
    set({ isSubmitting: false });

    if (error || !data) {
      set({ error: error?.message ?? 'Erreur lors du report de la tâche.' });
      return false;
    }

    set({ instances: get().instances.map((i) => (i.id === instanceId ? data : i)) });
    return true;
  },

  updateRecurringTask: async (params) => {
    set({ isSubmitting: true, error: null });
    const { data, error } = await callRpc('update_recurring_task', {
      p_task_id: params.taskId,
      p_assigned_to: params.assignedTo,
      p_recurrence_rule: params.recurrenceRule,
    });
    set({ isSubmitting: false });

    if (error || !data) {
      set({ error: error?.message ?? 'Erreur lors de la mise à jour de la tâche.' });
      return false;
    }

    // hasFetched: false pour refetch les instances : un changement d'assigné
    // touche des task_instances existantes, pas seulement la ligne `tasks`.
    set({ tasks: get().tasks.map((t) => (t.id === data.id ? data : t)), hasFetched: false });
    return true;
  },

  deleteTask: async (taskId) => {
    set({ isSubmitting: true, error: null });
    const { error } = await callRpc('delete_task', { p_task_id: taskId });
    set({ isSubmitting: false });

    if (error) {
      set({ error: error.message });
      return false;
    }

    set({
      tasks: get().tasks.filter((t) => t.id !== taskId),
      instances: get().instances.filter((i) => i.task_id !== taskId),
    });
    return true;
  },

  reset: () => set({ tasks: [], instances: [], isLoading: false, hasFetched: false, error: null }),

  clearError: () => set({ error: null }),
}));
