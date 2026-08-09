import type { TaskInstance, TaskInstanceStatus } from '../types/database';

export type DerivedInstanceStatus =
  | Exclude<TaskInstanceStatus, 'a_faire' | 'en_retard'>
  | 'a_venir'
  | 'en_cours'
  | 'bientot_en_retard'
  | 'en_retard';

const BIENTOT_EN_RETARD_THRESHOLD_MS = 30 * 60_000;

/**
 * Dérive le statut affichable d'une instance à partir de sa fenêtre de
 * réalisation et de l'heure actuelle. Calcul côté client (pas de colonne ou
 * vue SQL) : `now()` n'est pas immutable donc pas indexable/matérialisable
 * proprement côté DB, et un "temps restant" qui doit ticker en live est de
 * toute façon recalculé en continu par l'UI. Ne modifie jamais `status` en
 * base — 'en_retard' n'est ici qu'un label d'affichage tant qu'aucun job
 * planifié (phase 4) n'écrit le vrai statut.
 */
export function computeDerivedStatus(
  instance: Pick<TaskInstance, 'status' | 'window_start' | 'deadline'>,
  now: Date = new Date()
): DerivedInstanceStatus {
  if (instance.status !== 'a_faire') {
    return instance.status;
  }

  const nowMs = now.getTime();
  const windowStartMs = new Date(instance.window_start).getTime();
  const deadlineMs = new Date(instance.deadline).getTime();

  if (nowMs >= deadlineMs) {
    return 'en_retard';
  }
  if (nowMs < windowStartMs) {
    return 'a_venir';
  }
  if (deadlineMs - nowMs <= BIENTOT_EN_RETARD_THRESHOLD_MS) {
    return 'bientot_en_retard';
  }
  return 'en_cours';
}
