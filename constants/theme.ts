/**
 * Palette du mockup de navigation (design-mockup-nav.html), déclinée en clair
 * et sombre. Utilisée par les écrans sous app/(app)/(tabs), par onboarding et
 * task-create (+ composants partagés qu'ils utilisent) ; seuls les écrans
 * d'auth (sign-in, sign-up), affichés avant que la préférence de thème ait pu
 * être définie côté utilisateur, gardent leur charte fixe existante
 * (#2F6FED etc.), non concernée par cette réorganisation.
 *
 * Ne pas lire `themes` directement dans un écran : passer par `useTheme()`
 * (hooks/useTheme.ts), qui résout la bonne entrée selon le thème actif
 * (système ou forcé par l'utilisateur).
 */
export interface ThemeColors {
  background: string;
  backgroundMuted: string;
  card: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  textSectionHeader: string;
  accent: string;
  accentContrast: string;
  danger: string;
  dangerDark: string;
  inputBackground: string;
  placeholder: string;
}

export type ColorScheme = 'light' | 'dark';

const light: ThemeColors = {
  background: '#ffffff',
  backgroundMuted: '#f1efe8',
  card: '#ffffff',
  border: '#d3d1c7',
  textPrimary: '#2c2c2a',
  textMuted: '#888780',
  textSectionHeader: '#5f5e5a',
  accent: '#3b82f6',
  accentContrast: '#ffffff',
  danger: '#E24B4A',
  dangerDark: '#A32D2D',
  inputBackground: '#ffffff',
  placeholder: '#9AA0A6',
};

const dark: ThemeColors = {
  background: '#121212',
  backgroundMuted: '#2b2b2e',
  card: '#232326',
  border: '#333336',
  textPrimary: '#ffffff',
  textMuted: '#9a9a9a',
  textSectionHeader: '#9a9a9a',
  accent: '#3b82f6',
  accentContrast: '#ffffff',
  danger: '#E24B4A',
  dangerDark: '#ff6b6b',
  inputBackground: '#232326',
  placeholder: '#6b6b6b',
};

export const themes: Record<ColorScheme, ThemeColors> = { light, dark };
