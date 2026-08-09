-- Phase 3: CRUD tâches + fenêtre de réalisation
-- Tables `tasks` / `task_instances`, RLS (même pattern non-récursif que
-- groups/group_members via public.is_group_member), et génération des
-- instances de tâches récurrentes (garde simple : jour(s) de semaine +
-- génération glissante sur 7 jours, pas de moteur RRULE).

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  icon text not null check (char_length(trim(icon)) between 1 and 8),
  type text not null check (type in ('ponctuelle', 'recurrente', 'rotation')),
  -- Forme du jsonb pour recurrente/rotation (auto-suffisant, relu plus tard
  -- par refresh_recurring_instances sans dépendre des paramètres d'origine) :
  -- { "days_of_week": [1,3,5], "window_start_time": "18:00",
  --   "window_duration_minutes": 60, "deadline_time": "21:00",
  --   "timezone": "Europe/Paris" }
  -- days_of_week suit la convention JS Date.getDay() / Postgres
  -- extract(dow from ...) : 0 = dimanche ... 6 = samedi.
  recurrence_rule jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint tasks_recurrence_rule_matches_type
    check ((type = 'ponctuelle') = (recurrence_rule is null))
);

create index if not exists tasks_group_id_idx on tasks (group_id);

create table if not exists task_instances (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  assigned_to uuid not null references auth.users (id) on delete cascade,
  date date not null,
  window_start timestamptz not null,
  window_duration_minutes int not null check (window_duration_minutes > 0),
  deadline timestamptz not null,
  status text not null default 'a_faire'
    check (status in ('a_faire', 'terminee', 'en_retard', 'refusee', 'reportee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_instances_deadline_after_window check (deadline >= window_start),
  -- Clé d'idempotence pour la génération glissante (on conflict do nothing) :
  -- sans elle, rouvrir l'app dupliquerait les occurrences déjà générées.
  unique (task_id, date)
);

create index if not exists task_instances_task_id_idx on task_instances (task_id);
create index if not exists task_instances_assigned_to_idx on task_instances (assigned_to);

create or replace function public._set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger task_instances_set_updated_at
before update on task_instances
for each row
execute function public._set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table tasks enable row level security;
alter table task_instances enable row level security;

create policy "Members can view tasks of their group"
on tasks for select
to authenticated
using (
  public.is_group_member(group_id)
);

-- Pas de policy INSERT/UPDATE/DELETE directe sur tasks : toute création passe
-- par create_task (SECURITY DEFINER), même pattern que create_group/join_group.

create policy "Members can view instances of their group's tasks"
on task_instances for select
to authenticated
using (
  exists (
    select 1 from tasks t
    where t.id = task_instances.task_id
      and public.is_group_member(t.group_id)
  )
);

-- Déviation volontaire du pattern "tout par RPC" : ici pas de problème
-- d'oeuf-et-poule (l'utilisateur est déjà membre et déjà assigné), donc une
-- policy RLS directe suffit pour Terminer/Reporter/Refuser. Pas de policy
-- INSERT directe : les instances ne sont créées que via create_task /
-- refresh_recurring_instances.
create policy "Assignee can update their own instances"
on task_instances for update
to authenticated
using (
  assigned_to = auth.uid()
  and exists (
    select 1 from tasks t
    where t.id = task_instances.task_id
      and public.is_group_member(t.group_id)
  )
)
with check (
  assigned_to = auth.uid()
  and exists (
    select 1 from tasks t
    where t.id = task_instances.task_id
      and public.is_group_member(t.group_id)
  )
);

-- ============================================================================
-- Génération des instances récurrentes
-- ============================================================================

-- Fonction interne (non grantée à authenticated, appelée uniquement depuis
-- create_task / refresh_recurring_instances). Génère les occurrences
-- manquantes de p_from à p_from + p_days - 1 pour une tâche récurrente ou
-- rotation. Assigné repris de la dernière instance existante de la tâche,
-- sinon p_default_assignee (fourni par create_task à la création), sinon
-- created_by en dernier recours.
create or replace function public._generate_instances_for_task(
  p_task_id uuid,
  p_from date,
  p_days int,
  p_default_assignee uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t tasks;
  d date;
  dow int;
  days_of_week int[];
  fallback_assignee uuid;
  i int;
begin
  select * into t from tasks where id = p_task_id;

  if t.id is null or t.recurrence_rule is null then
    return;
  end if;

  select array(select jsonb_array_elements_text(t.recurrence_rule -> 'days_of_week'))::int[]
    into days_of_week;

  select assigned_to into fallback_assignee
  from task_instances
  where task_id = p_task_id
  order by date desc
  limit 1;

  fallback_assignee := coalesce(fallback_assignee, p_default_assignee, t.created_by);

  for i in 0..(p_days - 1) loop
    d := p_from + i;
    dow := extract(dow from d)::int;

    if dow = any (days_of_week) then
      insert into task_instances (
        task_id, assigned_to, date, window_start, window_duration_minutes, deadline, status
      )
      values (
        p_task_id,
        fallback_assignee,
        d,
        -- date + time -> timestamp (pas de timestamp + time en Postgres,
        -- d reste `date` ici, pas de cast ::timestamp avant l'addition)
        (d + (t.recurrence_rule ->> 'window_start_time')::time)
          at time zone (t.recurrence_rule ->> 'timezone'),
        (t.recurrence_rule ->> 'window_duration_minutes')::int,
        (d + (t.recurrence_rule ->> 'deadline_time')::time)
          at time zone (t.recurrence_rule ->> 'timezone'),
        'a_faire'
      )
      on conflict (task_id, date) do nothing;
    end if;
  end loop;
end;
$$;

revoke execute on function public._generate_instances_for_task(uuid, date, int, uuid) from public;

-- ============================================================================
-- Fonctions RPC
-- ============================================================================

-- Crée une tâche et sa/ses première(s) instance(s) dans une transaction
-- (évite un état orphelin tâche-sans-instance en cas d'échec à mi-chemin).
-- p_date/p_window_start/p_window_duration_minutes/p_deadline ne servent que
-- pour 'ponctuelle' ; pour 'recurrente'/'rotation' tout vient de
-- p_recurrence_rule, généré par _generate_instances_for_task.
create or replace function public.create_task(
  p_group_id uuid,
  p_title text,
  p_icon text,
  p_type text,
  p_assigned_to uuid,
  p_recurrence_rule jsonb default null,
  p_date date default null,
  p_window_start timestamptz default null,
  p_window_duration_minutes int default null,
  p_deadline timestamptz default null
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  new_task tasks;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'Vous n''appartenez pas à ce groupe' using errcode = '28000';
  end if;

  if not exists (
    select 1 from group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_assigned_to
  ) then
    raise exception 'L''assigné doit être membre du groupe' using errcode = 'P0001';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Le titre de la tâche est requis' using errcode = 'P0001';
  end if;

  if p_type not in ('ponctuelle', 'recurrente', 'rotation') then
    raise exception 'Type de tâche invalide' using errcode = 'P0001';
  end if;

  if p_type = 'ponctuelle' then
    if p_recurrence_rule is not null then
      raise exception 'Une tâche ponctuelle ne prend pas de règle de récurrence' using errcode = 'P0001';
    end if;
    if p_date is null or p_window_start is null or p_window_duration_minutes is null or p_deadline is null then
      raise exception 'Fenêtre de réalisation requise pour une tâche ponctuelle' using errcode = 'P0001';
    end if;
    if p_deadline < p_window_start then
      raise exception 'La deadline doit être après le début de la fenêtre' using errcode = 'P0001';
    end if;
  else
    if p_recurrence_rule is null
      or not (p_recurrence_rule ? 'days_of_week')
      or not (p_recurrence_rule ? 'window_start_time')
      or not (p_recurrence_rule ? 'window_duration_minutes')
      or not (p_recurrence_rule ? 'deadline_time')
      or not (p_recurrence_rule ? 'timezone')
    then
      raise exception 'Règle de récurrence incomplète' using errcode = 'P0001';
    end if;
  end if;

  insert into tasks (group_id, title, icon, type, recurrence_rule, created_by)
  values (p_group_id, trim(p_title), trim(p_icon), p_type, p_recurrence_rule, auth.uid())
  returning * into new_task;

  if p_type = 'ponctuelle' then
    insert into task_instances (task_id, assigned_to, date, window_start, window_duration_minutes, deadline)
    values (new_task.id, p_assigned_to, p_date, p_window_start, p_window_duration_minutes, p_deadline);
  else
    perform public._generate_instances_for_task(new_task.id, current_date, 7, p_assigned_to);
  end if;

  return new_task;
end;
$$;

revoke execute on function public.create_task(
  uuid, text, text, text, uuid, jsonb, date, timestamptz, int, timestamptz
) from public;
grant execute on function public.create_task(
  uuid, text, text, text, uuid, jsonb, date, timestamptz, int, timestamptz
) to authenticated;

-- Re-remplit le calendrier glissant (7 prochains jours) des tâches
-- récurrentes/rotation du groupe de l'appelant. Pas de cron/Edge Function
-- pour l'instant (phase 4 dans CLAUDE.md) : appelée côté client à chaque
-- ouverture de l'écran liste de tâches (fetchTasks), donc génération
-- paresseuse plutôt que planifiée.
create or replace function public.refresh_recurring_instances()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_group_id uuid;
  t record;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select group_id into my_group_id from group_members where user_id = auth.uid();

  if my_group_id is null then
    return;
  end if;

  for t in
    select id from tasks
    where group_id = my_group_id
      and type in ('recurrente', 'rotation')
      and recurrence_rule is not null
  loop
    perform public._generate_instances_for_task(t.id, current_date, 7, null);
  end loop;
end;
$$;

revoke execute on function public.refresh_recurring_instances() from public;
grant execute on function public.refresh_recurring_instances() to authenticated;
