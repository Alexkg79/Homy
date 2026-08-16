-- Multi-group support : un utilisateur peut désormais appartenir à plusieurs
-- groupes simultanément (V1 était mono-groupe, cf. commentaire d'origine sur
-- la contrainte unique(user_id) dans 20260808102411_create_groups_and_members.sql).

-- ============================================================================
-- group_members : unique(user_id) -> unique(group_id, user_id)
-- ============================================================================

alter table group_members drop constraint if exists group_members_user_id_key;
alter table group_members add constraint group_members_group_id_user_id_key unique (group_id, user_id);

-- ============================================================================
-- create_group : retire le blocage "vous appartenez déjà à un groupe"
-- ============================================================================

create or replace function public.create_group(group_name text, member_display_name text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group groups;
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  if length(trim(coalesce(group_name, ''))) = 0 then
    raise exception 'Le nom du groupe est requis' using errcode = 'P0001';
  end if;

  loop
    new_code := public._generate_invite_code();
    exit when not exists (select 1 from groups where invite_code = new_code);
  end loop;

  insert into groups (name, invite_code, created_by)
  values (trim(group_name), new_code, auth.uid())
  returning * into new_group;

  insert into group_members (group_id, user_id, display_name)
  values (
    new_group.id,
    auth.uid(),
    coalesce(nullif(trim(member_display_name), ''), 'Membre')
  );

  return new_group;
end;
$$;

-- ============================================================================
-- join_group : retire le même blocage, message clair si déjà membre de CE
-- groupe précis (sinon l'unique(group_id,user_id) remonterait une erreur
-- Postgres brute 23505 au lieu d'un message lisible)
-- ============================================================================

create or replace function public.join_group(code text, member_display_name text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group groups;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select * into target_group
  from groups
  where invite_code = upper(trim(coalesce(code, '')));

  if target_group.id is null then
    raise exception 'Code d''invitation invalide' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from group_members
    where group_id = target_group.id and user_id = auth.uid()
  ) then
    raise exception 'Vous êtes déjà membre de ce groupe' using errcode = 'P0001';
  end if;

  insert into group_members (group_id, user_id, display_name)
  values (
    target_group.id,
    auth.uid(),
    coalesce(nullif(trim(member_display_name), ''), 'Membre')
  );

  return target_group;
end;
$$;

-- ============================================================================
-- refresh_recurring_instances : fix bug multi-groupe. La version précédente
-- faisait `select group_id into my_group_id from group_members where
-- user_id = auth.uid()` : avec plusieurs lignes pour un même utilisateur,
-- Postgres prend arbitrairement la première rencontrée sans erreur, donc ne
-- régénérait les instances récurrentes que pour UN groupe sur plusieurs.
-- Boucle maintenant sur toutes les tâches récurrentes de tous les groupes de
-- l'appelant.
-- ============================================================================

create or replace function public.refresh_recurring_instances()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  for t in
    select tasks.id from tasks
    join group_members gm on gm.group_id = tasks.group_id
    where gm.user_id = auth.uid()
      and tasks.type in ('recurrente', 'rotation')
      and tasks.recurrence_rule is not null
  loop
    perform public._generate_instances_for_task(t.id, current_date, 7, null);
  end loop;
end;
$$;

revoke execute on function public.create_group(text, text) from public;
revoke execute on function public.join_group(text, text) from public;
revoke execute on function public.refresh_recurring_instances() from public;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text, text) to authenticated;
grant execute on function public.refresh_recurring_instances() to authenticated;
