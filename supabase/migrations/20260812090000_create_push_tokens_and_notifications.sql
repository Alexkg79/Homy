-- Phase 4: Notifications push
-- push_tokens (un ou plusieurs devices par utilisateur, un device peut être
-- réutilisé par un autre membre — ex: tablette partagée du salon), et
-- notifications_log pour l'idempotence côté Edge Function (évite les
-- doublons si le cron tourne plusieurs fois sur la même fenêtre).

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- unique (pas unique(user_id, token)) : si un device change de main (ex:
  -- tablette familiale partagée), le prochain enregistrement doit réattribuer
  -- ce token au nouvel utilisateur connecté, pas créer une ligne en doublon.
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on push_tokens (user_id);

create trigger push_tokens_set_updated_at
before update on push_tokens
for each row
execute function public._set_updated_at();

create table if not exists notifications_log (
  id uuid primary key default gen_random_uuid(),
  task_instance_id uuid not null references task_instances (id) on delete cascade,
  type text not null check (type in ('assignation', 'rappel_debut', 'rappel_deadline', 'en_retard')),
  sent_at timestamptz not null default now(),
  unique (task_instance_id, type)
);

create index if not exists notifications_log_instance_id_idx on notifications_log (task_instance_id);

-- ============================================================================
-- RLS
-- ============================================================================

alter table push_tokens enable row level security;

create policy "Users can view their own push tokens"
on push_tokens for select
to authenticated
using (user_id = auth.uid());

create policy "Users can delete their own push tokens"
on push_tokens for delete
to authenticated
using (user_id = auth.uid());

-- Pas de policy INSERT/UPDATE directe : l'enregistrement passe par la RPC
-- register_push_token (SECURITY DEFINER) ci-dessous. Nécessaire pour le cas
-- "device partagé" (ex: tablette du salon) : réattribuer un token existant
-- à un nouvel utilisateur est un UPDATE dont la ligne EXISTANTE appartient à
-- quelqu'un d'autre — la clause USING d'une policy directe se base sur le
-- propriétaire actuel de la ligne, donc bloquerait justement ce cas qu'on
-- veut permettre. La RPC contourne ça proprement (comme create_task pour
-- le problème d'oeuf-et-poule sur groups), sans jamais permettre d'assigner
-- un token à un user_id autre que l'appelant.

alter table notifications_log enable row level security;
-- Aucune policy : deny-all pour anon/authenticated. Seul le service_role
-- (utilisé par l'Edge Function) y accède, et service_role bypass RLS par
-- construction sur Supabase — cohérent avec le fait que ce log est un détail
-- d'implémentation serveur, pas une donnée que l'app doit lire ou écrire.

-- ============================================================================
-- Fonction RPC : enregistrement du push token
-- ============================================================================

create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  if length(trim(coalesce(p_token, ''))) = 0 then
    raise exception 'Token invalide' using errcode = 'P0001';
  end if;

  insert into push_tokens (user_id, token)
  values (auth.uid(), trim(p_token))
  on conflict (token) do update
    set user_id = excluded.user_id,
        updated_at = now();
end;
$$;

revoke execute on function public.register_push_token(text) from public;
grant execute on function public.register_push_token(text) to authenticated;

-- ============================================================================
-- Fonction : notifications dues
-- ============================================================================

-- Utilisée uniquement par l'Edge Function (service_role). 4 types, chacun
-- anti-joint contre notifications_log pour ne renvoyer que ce qui n'a pas
-- encore été notifié. Pour rappel_debut/rappel_deadline/en_retard, une notif
-- déjà envoyée mais antérieure au dernier updated_at de l'instance est
-- considérée comme "pas encore envoyée pour la fenêtre actuelle" : un Report
-- change window_start/deadline et bump updated_at (trigger existant), donc
-- les rappels se réarment naturellement pour la nouvelle fenêtre.
create or replace function public.get_due_notifications()
returns table (
  instance_id uuid,
  notif_type text,
  user_id uuid,
  task_title text,
  task_icon text
)
language sql
security definer
set search_path = public
as $$
  -- Assignation : one-shot, jamais réarmée par un Report (assigné ne change pas).
  select ti.id, 'assignation', ti.assigned_to, t.title, t.icon
  from task_instances ti
  join tasks t on t.id = ti.task_id
  where ti.status = 'a_faire'
    and not exists (
      select 1 from notifications_log nl
      where nl.task_instance_id = ti.id and nl.type = 'assignation'
    )

  union all

  -- Rappel début : dans les 10 minutes avant window_start, pas encore commencée.
  select ti.id, 'rappel_debut', ti.assigned_to, t.title, t.icon
  from task_instances ti
  join tasks t on t.id = ti.task_id
  where ti.status in ('a_faire', 'reportee')
    and now() >= ti.window_start - interval '10 minutes'
    and now() < ti.window_start
    and not exists (
      select 1 from notifications_log nl
      where nl.task_instance_id = ti.id
        and nl.type = 'rappel_debut'
        and nl.sent_at >= ti.updated_at
    )

  union all

  -- Rappel deadline : il reste <= 20% du temps total de la fenêtre.
  select ti.id, 'rappel_deadline', ti.assigned_to, t.title, t.icon
  from task_instances ti
  join tasks t on t.id = ti.task_id
  where ti.status in ('a_faire', 'reportee')
    and now() < ti.deadline
    and ti.deadline > ti.window_start
    and (extract(epoch from (ti.deadline - now()))
         / extract(epoch from (ti.deadline - ti.window_start))) <= 0.2
    and not exists (
      select 1 from notifications_log nl
      where nl.task_instance_id = ti.id
        and nl.type = 'rappel_deadline'
        and nl.sent_at >= ti.updated_at
    )

  union all

  -- En retard : deadline dépassée, toujours pas traitée.
  select ti.id, 'en_retard', ti.assigned_to, t.title, t.icon
  from task_instances ti
  join tasks t on t.id = ti.task_id
  where ti.status in ('a_faire', 'reportee')
    and now() >= ti.deadline
    and not exists (
      select 1 from notifications_log nl
      where nl.task_instance_id = ti.id
        and nl.type = 'en_retard'
        and nl.sent_at >= ti.updated_at
    );
$$;

revoke execute on function public.get_due_notifications() from public;
grant execute on function public.get_due_notifications() to service_role;
