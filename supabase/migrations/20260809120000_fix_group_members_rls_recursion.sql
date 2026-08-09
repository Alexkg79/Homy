-- Fix: "infinite recursion detected in policy for relation group_members"
--
-- La policy "Members can view members of their groups" (créée dans
-- 20260808102411_create_groups_and_members.sql) interroge group_members
-- depuis une policy définie SUR group_members : Postgres réévalue RLS pour
-- la sous-requête, qui redéclenche la policy, qui redéclenche la
-- sous-requête, etc. → boucle infinie.
--
-- Fix standard : sortir la vérification d'appartenance dans une fonction
-- SECURITY DEFINER. Une fonction SECURITY DEFINER s'exécute avec les
-- privilèges de son propriétaire et ne réévalue pas RLS sur les requêtes
-- qu'elle exécute en interne, donc plus de récursion.

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_members.group_id = target_group_id
      and group_members.user_id = auth.uid()
  );
$$;

revoke execute on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;

drop policy if exists "Members can view their groups" on groups;
create policy "Members can view their groups"
on groups for select
to authenticated
using (
  public.is_group_member(id)
);

drop policy if exists "Members can view members of their groups" on group_members;
create policy "Members can view members of their groups"
on group_members for select
to authenticated
using (
  public.is_group_member(group_id)
);
