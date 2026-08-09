// Edge Function déclenchée par pg_cron (toutes les minutes, voir la SQL de
// setup). Calcule les notifications dues via get_due_notifications() (SQL,
// service_role bypass RLS), les envoie à l'API Expo Push, et logge dans
// notifications_log AVANT l'envoi pour garantir l'idempotence même si un
// tick suivant tourne pendant que celui-ci est encore en cours, ou si
// l'appel à l'API Expo échoue/time out.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Secret partagé, distinct de la clé anon utilisée pour passer la
// vérification JWT du gateway Supabase (cf. pattern officiel de scheduling).
// Sans ce check, n'importe qui possédant la clé anon (publique, embarquée
// dans l'app) pourrait déclencher des envois de push à volonté.
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface DueNotification {
  instance_id: string;
  notif_type: 'assignation' | 'rappel_debut' | 'rappel_deadline' | 'en_retard';
  user_id: string;
  task_title: string;
  task_icon: string | null;
}

const MESSAGE_BUILDERS: Record<
  DueNotification['notif_type'],
  (title: string, icon: string) => { title: string; body: string }
> = {
  assignation: (title, icon) => ({
    title: 'Nouvelle tâche',
    body: `${icon} ${title} t'a été assignée.`,
  }),
  rappel_debut: (title, icon) => ({
    title: 'Ça commence bientôt',
    body: `${icon} ${title} commence dans 10 minutes.`,
  }),
  rappel_deadline: (title, icon) => ({
    title: 'Bientôt en retard',
    body: `${icon} ${title} : il reste peu de temps avant la deadline.`,
  }),
  en_retard: (title, icon) => ({
    title: 'En retard',
    body: `${icon} ${title} est en retard.`,
  }),
};

Deno.serve(async (req) => {
  if (CRON_SECRET) {
    const provided = req.headers.get('x-cron-secret');
    if (provided !== CRON_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const { data: due, error: dueError } = await supabase.rpc('get_due_notifications');
  if (dueError) {
    console.error('get_due_notifications failed', dueError);
    return new Response(JSON.stringify({ error: dueError.message }), { status: 500 });
  }

  const dueList = (due ?? []) as DueNotification[];
  if (dueList.length === 0) {
    return new Response(JSON.stringify({ due: 0, sent: 0 }), { status: 200 });
  }

  const userIds = [...new Set(dueList.map((d) => d.user_id))];
  const { data: tokenRows, error: tokenError } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds);

  if (tokenError) {
    console.error('push_tokens fetch failed', tokenError);
    return new Response(JSON.stringify({ error: tokenError.message }), { status: 500 });
  }

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows ?? []) {
    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.token);
    tokensByUser.set(row.user_id, list);
  }

  const messages: { to: string; title: string; body: string; data: Record<string, unknown> }[] = [];

  for (const item of dueList) {
    const { title, body } = MESSAGE_BUILDERS[item.notif_type](
      item.task_title,
      item.task_icon ?? ''
    );
    const tokens = tokensByUser.get(item.user_id) ?? [];
    for (const token of tokens) {
      messages.push({
        to: token,
        title,
        body,
        data: { instanceId: item.instance_id, type: item.notif_type },
      });
    }
  }

  // Upsert (pas insert simple, pas ignoreDuplicates) : (instance_id, type)
  // est une clé stable dans le temps, mais un Report doit pouvoir la
  // "réarmer" en rafraîchissant sent_at (voir get_due_notifications, qui
  // compare sent_at à task_instances.updated_at). Loggé même pour les
  // utilisateurs sans token enregistré, pour ne pas re-tenter en boucle.
  const logRows = dueList.map((item) => ({
    task_instance_id: item.instance_id,
    type: item.notif_type,
  }));
  const { error: logError } = await supabase
    .from('notifications_log')
    .upsert(logRows, { onConflict: 'task_instance_id,type' });

  if (logError) {
    console.error('notifications_log upsert failed', logError);
    // On continue quand même l'envoi : mieux vaut un doublon rare qu'un push
    // jamais envoyé si le log échoue pour une raison transitoire.
  }

  let sent = 0;
  const CHUNK_SIZE = 100; // limite recommandée par l'API Expo Push
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.error('Expo push API error', res.status, await res.text());
        continue;
      }
      sent += chunk.length;
    } catch (err) {
      console.error('Expo push API request failed', err);
    }
  }

  return new Response(JSON.stringify({ due: dueList.length, sent }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
