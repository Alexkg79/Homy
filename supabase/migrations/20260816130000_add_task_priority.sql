-- Priorité de tâche (normale/urgente), garde simple : pas de recoloration de
-- card côté UI (conflit visuel avec le dégradé vert->rouge de la jauge),
-- juste une donnée affichée en bordure + badge côté client.

alter table tasks
  add column if not exists priority text not null default 'normale'
    check (priority in ('normale', 'urgente'));

-- create_task change de signature (nouveau paramètre p_priority) : drop de
-- l'ancienne avant recreate, sinon Postgres crée un second overload au lieu
-- de remplacer (l'ancien argument list resterait résolvable et ambiguë).
drop function if exists public.create_task(
  uuid, text, text, text, uuid, jsonb, date, timestamptz, int, timestamptz
);

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
  p_deadline timestamptz default null,
  p_priority text default 'normale'
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

  if p_priority not in ('normale', 'urgente') then
    raise exception 'Priorité de tâche invalide' using errcode = 'P0001';
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

  insert into tasks (group_id, title, icon, type, recurrence_rule, created_by, priority)
  values (p_group_id, trim(p_title), trim(p_icon), p_type, p_recurrence_rule, auth.uid(), p_priority)
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
  uuid, text, text, text, uuid, jsonb, date, timestamptz, int, timestamptz, text
) from public;
grant execute on function public.create_task(
  uuid, text, text, text, uuid, jsonb, date, timestamptz, int, timestamptz, text
) to authenticated;
