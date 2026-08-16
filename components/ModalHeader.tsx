import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts } from '../constants/typography';
import { useTheme } from '../hooks/useTheme';
import { withPressedOpacity } from '../lib/pressedStyle';

interface ModalHeaderProps {
  title: string;
  /** Même convention que GroupSwitcherHeader : l'écran passe insets.top + offset. */
  paddingTop: number;
}

/**
 * Header dessiné dans le contenu de l'écran plutôt que le header natif du
 * Stack (headerShown: false sur ces écrans, voir app/(app)/_layout.tsx) :
 * titre et carte font partie de la même vue animée, donc pas de désync
 * possible entre le header et le contenu pendant l'animation slide_from_bottom.
 */
export function ModalHeader({ title, paddingTop }: ModalHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { paddingTop, borderBottomColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        hitSlop={8}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.close, withPressedOpacity(pressed)]}
      >
        <Ionicons name="close" size={24} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    flexShrink: 1,
  },
  close: {
    padding: 2,
  },
});
