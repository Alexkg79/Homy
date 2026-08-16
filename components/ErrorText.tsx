import { StyleSheet, Text } from 'react-native';

import { fonts } from '../constants/typography';

interface ErrorTextProps {
  children: string | null;
  color?: string;
}

/**
 * color par défaut = charte fixe des écrans d'auth (sign-in, sign-up), seuls
 * écrans restants hors thème. Les autres écrans passent
 * color={theme.colors.danger} explicitement pour suivre le thème actif.
 */
export function ErrorText({ children, color = '#D64545' }: ErrorTextProps) {
  if (!children) return null;
  return <Text style={[styles.text, { color }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    fontFamily: fonts.regular,
  },
});
