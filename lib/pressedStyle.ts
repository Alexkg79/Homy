import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Feedback tactile uniforme (opacité) sur tous les Pressable de l'app :
 * `style={({ pressed }) => [base, withPressedOpacity(pressed)]}`.
 */
export function withPressedOpacity(pressed: boolean): StyleProp<ViewStyle> {
  return pressed ? { opacity: 0.6 } : undefined;
}
