import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useTheme } from '../hooks/useTheme';

interface ProgressBarProps {
  ratio: number;
  color: string;
  /**
   * Pulsation légère (opacité) pour attirer l'oeil quand la deadline
   * approche (seuil "bientot_en_retard" de lib/task-status.ts, décidé côté
   * appelant). false par défaut : la barre reste fixe (utilisé aussi pour
   * l'état "en retard", volontairement rouge plein sans pulsation
   * permanente, ça fatiguerait visuellement).
   */
  pulse?: boolean;
}

/** Barre horizontale simple (View + largeur en %), pas de lib de charting. */
export function ProgressBar({ ratio, color, pulse = false }: ProgressBarProps) {
  const { colors } = useTheme();
  const pct = Math.min(1, Math.max(0, ratio));
  // Animé plutôt qu'un affichage instantané : part de 0 au montage, puis
  // suit les mises à jour de `ratio` (jauge qui avance toutes les 30s) avec
  // la même transition douce.
  const widthAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, widthAnim]);

  useEffect(() => {
    if (!pulse) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseAnim]);

  return (
    <Animated.View
      style={[styles.track, { backgroundColor: colors.backgroundMuted, opacity: pulseAnim }]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
