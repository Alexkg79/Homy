import type { TaskInstance } from '../types/database';

export interface OnTimeStats {
  resolvedCount: number;
  onTimeCount: number;
  /** null tant qu'aucune instance n'est résolue (pas de division par 0). */
  onTimeRate: number | null;
}

const ROLLING_WINDOW_DAYS = 7;

/**
 * "Terminée à l'heure" : validée avant la deadline. `updated_at` est
 * mis à jour par le trigger existant à chaque changement de statut (voir
 * migration create_tasks_and_instances), donc au moment précis du passage à
 * 'terminee' — pas besoin d'une colonne dédiée type completed_at.
 */
function isOnTimeCompletion(instance: TaskInstance): boolean {
  return new Date(instance.updated_at).getTime() <= new Date(instance.deadline).getTime();
}

function isResolved(instance: TaskInstance, now: Date): boolean {
  if (instance.status === 'terminee' || instance.status === 'refusee') {
    return true;
  }
  // 'a_faire' / 'reportee' dont la deadline est dépassée : en retard non
  // traité, donc déjà comptabilisable côté stats (même logique que le statut
  // dérivé 'en_retard' de lib/task-status.ts, mais on évite la dépendance
  // pour ne pas coupler un module de stats à un module de statut d'affichage).
  return now.getTime() >= new Date(instance.deadline).getTime();
}

/**
 * % de tâches à l'heure sur une fenêtre glissante de `windowDays` jours
 * (approximation volontairement simple de "la semaine en cours" : pas de
 * calcul de lundi-dimanche, ce qui resterait arbitraire côté fuseau/locale).
 * Calcul 100% client à partir des task_instances déjà chargées par
 * useTaskStore — pas de vue SQL, cohérent avec computeDerivedStatus qui fait
 * le même choix pour les mêmes raisons.
 */
export function computeOnTimeStats(
  instances: TaskInstance[],
  now: Date = new Date(),
  windowDays: number = ROLLING_WINDOW_DAYS
): OnTimeStats {
  const cutoffMs = now.getTime() - windowDays * 24 * 60 * 60_000;
  let resolvedCount = 0;
  let onTimeCount = 0;

  for (const instance of instances) {
    if (new Date(instance.deadline).getTime() < cutoffMs) {
      continue;
    }
    if (!isResolved(instance, now)) {
      continue;
    }
    resolvedCount += 1;
    if (instance.status === 'terminee' && isOnTimeCompletion(instance)) {
      onTimeCount += 1;
    }
  }

  return {
    resolvedCount,
    onTimeCount,
    onTimeRate: resolvedCount > 0 ? onTimeCount / resolvedCount : null,
  };
}

/**
 * Nombre de tâches consécutives terminées à l'heure, en partant de la plus
 * récente échéance résolue. S'arrête à la première résolution tardive ou
 * refusée. Les instances non encore résolues (à venir/en cours) sont
 * ignorées plutôt que de casser le streak.
 */
export function computeOnTimeStreak(instances: TaskInstance[], now: Date = new Date()): number {
  const resolved = instances
    .filter((instance) => isResolved(instance, now))
    .slice()
    .sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());

  let streak = 0;
  for (const instance of resolved) {
    if (instance.status === 'terminee' && isOnTimeCompletion(instance)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}
