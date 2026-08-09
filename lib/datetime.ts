/** Combine la date (Y/M/D) d'une valeur avec l'heure (H/M) d'une autre. */
export function combineDateAndTime(datePart: Date, timePart: Date): Date {
  const combined = new Date(datePart);
  combined.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return combined;
}

/**
 * "YYYY-MM-DD" à partir des composants locaux (pas `toISOString().slice(0,10)`,
 * qui convertit en UTC et peut faire sauter au jour d'avant/après selon le
 * fuseau horaire de l'appareil).
 */
export function toDateOnlyString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse une colonne `date` Postgres ("YYYY-MM-DD") en Date locale à minuit.
 * Ne PAS utiliser `new Date(dateOnlyString)` : un format date-only est
 * interprété comme minuit UTC par le spec JS, ce qui peut afficher le
 * mauvais jour une fois reformaté en heure locale (ex: décalage US).
 */
export function parseDateOnly(dateOnlyString: string): Date {
  const [y, m, day] = dateOnlyString.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** "YYYY-MM-DD" -> "Jeudi 13 août". */
export function formatDaySectionHeader(dateOnlyString: string): string {
  const formatted = parseDateOnly(dateOnlyString).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return capitalize(formatted);
}
