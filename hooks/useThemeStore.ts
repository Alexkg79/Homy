import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark';

const STORAGE_KEY = 'homy-theme-preference';

interface ThemePreferenceState {
  preference: ThemePreference;
  init: () => void;
  setPreference: (preference: ThemePreference) => void;
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark';
}

/**
 * Stocke la préférence de thème, choix binaire clair/sombre (pas de mode
 * "système" : retiré pour un choix plus simple côté utilisateur). Une valeur
 * historique "system" (ou absente/corrompue) est résolue une seule fois à
 * partir du thème système actuel au moment du chargement, puis figée en
 * AsyncStorage — elle ne sera plus jamais réévaluée dynamiquement après ça.
 */
export const useThemeStore = create<ThemePreferenceState>((set) => ({
  preference: 'dark',

  init: () => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (isThemePreference(stored)) {
        set({ preference: stored });
        return;
      }
      const resolved: ThemePreference = Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
      set({ preference: resolved });
      AsyncStorage.setItem(STORAGE_KEY, resolved);
    });
  },

  setPreference: (preference) => {
    set({ preference });
    AsyncStorage.setItem(STORAGE_KEY, preference);
  },
}));
