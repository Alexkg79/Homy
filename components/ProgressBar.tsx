import { StyleSheet, View } from 'react-native';

interface ProgressBarProps {
  ratio: number;
  color: string;
}

/** Barre horizontale simple (View + largeur en %), pas de lib de charting. */
export function ProgressBar({ ratio, color }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F2F5',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
