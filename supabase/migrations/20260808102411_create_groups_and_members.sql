-- Phase 2: Auth + groupes
-- Tables `groups` / `group_members`, RLS, et fonctions RPC pour créer/rejoindre
-- un groupe de façon atomique (contourne le problème d'oeuf-et-poule des policies
-- RLS : on ne peut pas SELECT un groupe dont on n'est pas encore membre).

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  avatar_url text,
  joined_at timestamptz not null default now(),
  -- V1 : un utilisateur n'appartient qu'à un seul groupe à la fois.
  -- A lever (remplacer par unique(group_id, user_id)) si la V2 autorise le multi-groupe.
  unique (user_id)
);

create index if not exists group_members_group_id_idx on group_members (group_id);

-- ============================================================================
-- RLS
-- ============================================================================

alter table groups enable row level security;
alter table group_members enable row level security;

-- Un membre ne voit que les groupes dont il fait partie.
create policy "Members can view their groups"
on groups for select
to authenticated
using (
  exists (
    select 1 from group_members
    where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
  )
);

-- Un membre voit les autres membres des groupes dont il fait partie
-- (pattern self-join classique pour les tables de membership).
create policy "Members can view members of their groups"
on group_members for select
to authenticated
using (
  exists (
    select 1 from group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
  )
);

-- Pas de policy INSERT/UPDATE/DELETE directe : toute écriture passe par les
-- fonctions SECURITY DEFINER ci-dessous, qui s'exécutent avec les privilèges
-- du propriétaire de la fonction et contournent donc RLS de façon contrôlée.

-- ============================================================================
-- Fonctions RPC
-- ============================================================================

create or replace function public._generate_invite_code()
returns text
language plpgsql
as $$
declare
  -- alphabet sans caractères ambigus (pas de 0/O, 1/I)
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return code;
end;
$$;

revoke execute on function public._generate_invite_code() from public;

-- Crée un groupe et y ajoute directement son créateur comme premier membre,
-- dans une seule transaction (évite tout état orphelin en cas d'échec).
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

  if exists (select 1 from group_members where user_id = auth.uid()) then
    raise exception 'Vous appartenez déjà à un groupe' using errcode = 'P0001';
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

-- Rejoint un groupe existant via son invite_code.
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

  if exists (select 1 from group_members where user_id = auth.uid()) then
    raise exception 'Vous appartenez déjà à un groupe' using errcode = 'P0001';
  end if;

  select * into target_group
  from groups
  where invite_code = upper(trim(coalesce(code, '')));

  if target_group.id is null then
    raise exception 'Code d''invitation invalide' using errcode = 'P0002';
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

revoke execute on function public.create_group(text, text) from public;
revoke execute on function public.join_group(text, text) from public;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text, text) to authenticated;
