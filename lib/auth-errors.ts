import type { AuthError } from '@supabase/supabase-js';

/**
 * Supabase Auth (GoTrue) renvoie des messages d'erreur en anglais, non
 * localisables côté dashboard. On mappe ici les cas les plus courants.
 */
export function mapAuthError(error: AuthError): string {
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Email ou mot de passe incorrect.';
    case 'User already registered':
      return 'Un compte existe déjà avec cet email. Essaie de te connecter.';
    case 'Password should be at least 6 characters':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'Email not confirmed':
      return 'Confirme ton email avant de te connecter (vérifie ta boîte mail).';
    case 'Unable to validate email address: invalid format':
      return 'Adresse email invalide.';
    default:
      return error.message;
  }
}
