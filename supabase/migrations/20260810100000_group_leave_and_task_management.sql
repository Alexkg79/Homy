-- Phase 5: navigation par tab bar (Accueil / Tâches / Groupe / Profil)
-- Ajoute ce qu'il fallait pour les nouveaux écrans Groupe/Profil/Tâches :
--   - quitter le groupe + modifier son nom affiché (policies directes sur
--     group_members, ciblées sur la ligne de l'appelant : pas de sous-requête
--     sur group_members donc pas de risque de récursion, contrairement à la
--     policy SELECT corrigée dans 20260809120000_fix_group_members_rls_recursion.sql)
--   - gestion d'une tâche récurrente (réassigner les prochaines occurrences,
--     changer la règle de récurrence, supprimer) depuis l'onglet Tâches

-- ============================================================================
-- group_members : quitter le groupe / modifier son nom affiché
-- ============================================================================

create policy "Members can update their own membership"
on group_members for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Members can delete their own membership"
on group_members for delete
to authenticated
using (user_id = auth.uid());

-- ============================================================================
-- Gestion d'une tâche récurrente
-- ============================================================================

-- Réassigne les prochaines occurrences non traitées d'une tâche récurrente/
-- rotation et/ou met à jour sa règle de récurrence. Pas de colonne "assigné
-- par défaut" sur `tasks` : réassigner revient à mettre à jour assigned_to
-- sur les instances futures encore actives, ce qui devient alors la "dernière
-- instance" que _generate_instances_for_task utilise comme fallback pour les
-- prochaines générations glissantes (cf. create_tasks_and_instances.sql).
create or replace function public.update_recurring_task(
  p_task_id uuid,
  p_assigned_to uuid default null,
  p_recurrence_rule jsonb default null
)
returns tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  target tasks;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select * into target from tasks where id = p_task_id;
  if target.id is null then
    raise exception 'Tâche introuvable' using errcode = 'P0002';
  end if;
  if not public.is_group_member(target.group_id) then
    raise exception 'Vous n''appartenez pas à ce groupe' using errcode = '28000';
  end if;
  if target.type = 'ponctuelle' then
    raise exception 'Cette tâche n''est pas récurrente' using errcode = 'P0001';
  end if;

  if p_assigned_to is not null then
    if not exists (
      select 1 from group_members gm
      where gm.group_id = target.group_id and gm.user_id = p_assigned_to
    ) then
      raise exception 'L''assigné doit être membre du groupe' using errcode = 'P0001';
    end if;

    update task_instances
    set assigned_to = p_assigned_to
    where task_id = p_task_id
      and status in ('a_faire', 'reportee')
      and date >= current_date;
  end if;

  if p_recurrence_rule is not null then
    if not (p_recurrence_rule ? 'days_of_week')
      or not (p_recurrence_rule ? 'window_start_time')
      or not (p_recurrence_rule ? 'window_duration_minutes')
      or not (p_recurrence_rule ? 'deadline_time')
      or not (p_recurrence_rule ? 'timezone')
    then
      raise exception 'Règle de récurrence incomplète' using errcode = 'P0001';
    end if;

    update tasks set recurrence_rule = p_recurrence_rule where id = p_task_id;
  end if;

  select * into target from tasks where id = p_task_id;
  return target;
end;
$$;

revoke execute on function public.update_recurring_task(uuid, uuid, jsonb) from public;
grant execute on function public.update_recurring_task(uuid, uuid, jsonb) to authenticated;

-- Supprime une tâche (et ses instances, via le on delete cascade existant
-- sur task_instances.task_id). Pas de policy DELETE directe sur `tasks`
-- (même pattern "tout par RPC" que sa création).
create or replace function public.delete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select group_id into target_group_id from tasks where id = p_task_id;
  if target_group_id is null then
    raise exception 'Tâche introuvable' using errcode = 'P0002';
  end if;
  if not public.is_group_member(target_group_id) then
    raise exception 'Vous n''appartenez pas à ce groupe' using errcode = '28000';
  end if;

  delete from tasks where id = p_task_id;
end;
$$;

revoke execute on function public.delete_task(uuid) from public;
grant execute on function public.delete_task(uuid) to authenticated;
