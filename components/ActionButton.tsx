import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { ThemeColors } from '../constants/theme';
import { fonts } from '../constants/typography';
import { withPressedOpacity } from '../lib/pressedStyle';

export type ActionVariant = 'filled' | 'outline' | 'soft-danger';

interface ActionButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: ActionVariant;
  onPress: () => void;
  disabled?: boolean;
  colors: ThemeColors;
}

/**
 * Style d'action partagé par les cards de tâche (TaskInstanceCard,
 * RecurringTaskEditor) : plein accent pour l'action positive/principale
 * (Terminer, Confirmer, Enregistrer), outline discret pour l'action neutre
 * (Reporter, Annuler), rouge doux (fond teinté, pas plein) pour l'action
 * destructive/négative (Refuser, Supprimer) — volontairement peu agressif.
 */
export function ActionButton({ label, icon, variant, onPress, disabled, colors }: ActionButtonProps) {
  const variantStyle =
    variant === 'filled'
      ? { backgroundColor: colors.accent }
      : variant === 'soft-danger'
        ? { backgroundColor: colors.dangerMuted }
        : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border };
  const contentColor =
    variant === 'filled' ? colors.accentContrast : variant === 'soft-danger' ? colors.danger : colors.textPrimary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        variantStyle,
        disabled && styles.actionBtnDisabled,
        withPressedOpacity(pressed),
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Ionicons name={icon} size={15} color={contentColor} />
      <Text style={[styles.actionLabel, { color: contentColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
});
