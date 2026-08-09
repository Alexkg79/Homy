import type { TaskInstance, TaskInstanceStatus } from '../types/database';

export type DerivedInstanceStatus =
  | Exclude<TaskInstanceStatus, 'a_faire' | 'en_retard'>
  | 'a_venir'
  | 'en_cours'
  | 'bientot_en_retard'
  | 'en_retard';

const BIENTOT_EN_RETARD_THRESHOLD_MS = 30 * 60_000;

type WindowInstance = Pick<TaskInstance, 'window_start' | 'deadline'>;

function windowBoundsMs(instance: WindowInstance): { startMs: number; deadlineMs: number } {
  return {
    startMs: new Date(instance.window_start).getTime(),
    deadlineMs: new Date(instance.deadline).getTime(),
  };
}

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
  const { startMs, deadlineMs } = windowBoundsMs(instance);

  if (nowMs >= deadlineMs) {
    return 'en_retard';
  }
  if (nowMs < startMs) {
    return 'a_venir';
  }
  if (deadlineMs - nowMs <= BIENTOT_EN_RETARD_THRESHOLD_MS) {
    return 'bientot_en_retard';
  }
  return 'en_cours';
}

/**
 * Position dans la fenêtre de réalisation, clampée [0, 1] :
 * 0 = window_start, 1 = deadline (et reste à 1 au-delà, donc "en retard"
 * affiche naturellement une barre pleine sans cas particulier). Réutilise
 * les mêmes bornes que computeDerivedStatus plutôt que de reparser
 * window_start/deadline séparément.
 */
export function computeProgressRatio(instance: WindowInstance, now: Date = new Date()): number {
  const nowMs = now.getTime();
  const { startMs, deadlineMs } = windowBoundsMs(instance);

  if (deadlineMs <= startMs) {
    return 1;
  }

  const ratio = (nowMs - startMs) / (deadlineMs - startMs);
  return Math.min(1, Math.max(0, ratio));
}

const PROGRESS_COLOR_START = { r: 0x2e, g: 0x9e, b: 0x5b }; // vert, loin de la deadline
const PROGRESS_COLOR_END = { r: 0xd6, g: 0x45, b: 0x45 }; // rouge, proche/dépassée

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Dégradé vert -> rouge par interpolation RGB linéaire sur le ratio [0, 1]. */
export function progressColor(ratio: number): string {
  const t = Math.min(1, Math.max(0, ratio));
  const r = lerp(PROGRESS_COLOR_START.r, PROGRESS_COLOR_END.r, t);
  const g = lerp(PROGRESS_COLOR_START.g, PROGRESS_COLOR_END.g, t);
  const b = lerp(PROGRESS_COLOR_START.b, PROGRESS_COLOR_END.b, t);
  return `rgb(${r}, ${g}, ${b})`;
}
