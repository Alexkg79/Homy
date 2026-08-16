/**
 * Types manuels, calqués sur le format généré par `supabase gen types typescript`.
 * Aucun projet Supabase n'est encore lié dans cet environnement, donc ce fichier
 * est écrit à la main à partir des migrations SQL (supabase/migrations/).
 *
 * Note : `groups` et `group_members` n'ont volontairement pas de policy RLS
 * INSERT (les créations passent par les fonctions RPC create_group /
 * join_group). group_members a en revanche des policies UPDATE/DELETE
 * directes, mais limitées à la ligne de l'appelant (quitter le groupe,
 * modifier son propre nom affiché — voir
 * 20260810100000_group_leave_and_task_management.sql). Les types Insert/
 * Update reflètent quand même la forme réelle des tables : c'est RLS, pas
 * TypeScript, qui empêche les écritures non autorisées.
 *
 * Une fois le projet lié (`supabase link --project-ref <ref>`), régénère avec :
 *   npx supabase gen types typescript --linked > types/database.ts
 */

type GroupRow = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

type GroupMemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  joined_at: string;
};

export type TaskType = 'ponctuelle' | 'recurrente' | 'rotation';

/**
 * Forme du jsonb `tasks.recurrence_rule` pour 'recurrente'/'rotation' (null
 * pour 'ponctuelle'). days_of_week suit la convention JS Date.getDay() /
 * Postgres extract(dow from ...) : 0 = dimanche ... 6 = samedi.
 * `timezone` est une zone IANA (ex: "Europe/Paris"), lue côté SQL avec
 * `at time zone` pour générer des window_start/deadline corrects.
 */
export type RecurrenceRule = {
  days_of_week: number[];
  window_start_time: string; // "HH:MM"
  window_duration_minutes: number;
  deadline_time: string; // "HH:MM"
  timezone: string;
};

export type TaskInstanceStatus = 'a_faire' | 'terminee' | 'en_retard' | 'refusee' | 'reportee';

type TaskRow = {
  id: string;
  group_id: string;
  title: string;
  icon: string;
  type: TaskType;
  recurrence_rule: RecurrenceRule | null;
  created_by: string;
  created_at: string;
};

type TaskInstanceRow = {
  id: string;
  task_id: string;
  assigned_to: string;
  date: string;
  window_start: string;
  window_duration_minutes: number;
  deadline: string;
  status: TaskInstanceStatus;
  created_at: string;
  updated_at: string;
};

type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Views: Record<string, never>;
    Tables: {
      groups: {
        Row: GroupRow;
        Insert: Partial<GroupRow> & Pick<GroupRow, 'name' | 'invite_code' | 'created_by'>;
        Update: Partial<GroupRow>;
        Relationships: [];
      };
      group_members: {
        Row: GroupMemberRow;
        Insert: Partial<GroupMemberRow> &
          Pick<GroupMemberRow, 'group_id' | 'user_id' | 'display_name'>;
        Update: Partial<GroupMemberRow>;
        Relationships: [];
      };
      // Insert présent pour satisfaire la forme attendue par supabase-js
      // (Row/Insert/Update/Relationships), mais écriture réellement possible
      // uniquement via la RPC create_task : pas de policy RLS INSERT directe
      // (même pattern que groups). Idem task_instances pour l'INSERT ; son
      // UPDATE, lui, est permis directement (voir policy RLS "Assignee can
      // update their own instances").
      tasks: {
        Row: TaskRow;
        Insert: Partial<TaskRow> &
          Pick<TaskRow, 'group_id' | 'title' | 'icon' | 'type' | 'created_by'>;
        Update: Partial<TaskRow>;
        Relationships: [];
      };
      task_instances: {
        Row: TaskInstanceRow;
        Insert: Partial<TaskInstanceRow> &
          Pick<
            TaskInstanceRow,
            | 'task_id'
            | 'assigned_to'
            | 'date'
            | 'window_start'
            | 'window_duration_minutes'
            | 'deadline'
          >;
        Update: Partial<
          Pick<TaskInstanceRow, 'status' | 'date' | 'window_start' | 'deadline' | 'assigned_to'>
        >;
        Relationships: [];
      };
      // Pas de notifications_log ici : RLS deny-all côté client (aucune
      // policy), seul service_role y accède depuis l'Edge Function — pas
      // besoin d'un type que l'app n'utilisera jamais.
      //
      // Insert/Update présents pour la forme (comme tasks), mais écriture
      // réelle uniquement via la RPC register_push_token : un upsert direct
      // client ne peut pas gérer la réattribution d'un token existant à un
      // autre utilisateur (device partagé) sous RLS. SELECT/DELETE restent
      // directs (own-row, pas de souci d'ownership croisé).
      push_tokens: {
        Row: PushTokenRow;
        Insert: Partial<PushTokenRow> & Pick<PushTokenRow, 'user_id' | 'token'>;
        Update: Partial<Pick<PushTokenRow, 'user_id' | 'token'>>;
        Relationships: [];
      };
    };
    Functions: {
      create_group: {
        Args: { group_name: string; member_display_name: string };
        Returns: GroupRow;
      };
      join_group: {
        Args: { code: string; member_display_name: string };
        Returns: GroupRow;
      };
      create_task: {
        Args: {
          p_group_id: string;
          p_title: string;
          p_icon: string;
          p_type: TaskType;
          p_assigned_to: string;
          p_recurrence_rule: RecurrenceRule | null;
          p_date: string | null;
          p_window_start: string | null;
          p_window_duration_minutes: number | null;
          p_deadline: string | null;
        };
        Returns: TaskRow;
      };
      refresh_recurring_instances: {
        Args: Record<string, never>;
        Returns: null;
      };
      register_push_token: {
        Args: { p_token: string };
        Returns: null;
      };
      update_recurring_task: {
        Args: {
          p_task_id: string;
          p_assigned_to: string | null;
          p_recurrence_rule: RecurrenceRule | null;
        };
        Returns: TaskRow;
      };
      delete_task: {
        Args: { p_task_id: string };
        Returns: null;
      };
    };
  };
};

export type Group = GroupRow;
export type GroupMember = GroupMemberRow;
export type Task = TaskRow;
export type TaskInstance = TaskInstanceRow;
export type PushToken = PushTokenRow;
