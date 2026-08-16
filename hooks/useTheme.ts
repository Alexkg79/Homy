import { themes, type ThemeColors } from '../constants/theme';
import { useThemeStore, type ThemePreference } from './useThemeStore';

interface UseThemeResult {
  colors: ThemeColors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

/**
 * Point d'entrée unique pour lire le thème actif dans un écran/composant :
 * lit la préférence persistée (clair/sombre, hooks/useThemeStore), qui est
 * directement la couleur active — pas de mode "système" à résoudre.
 */
export function useTheme(): UseThemeResult {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return { colors: themes[preference], preference, setPreference };
}
