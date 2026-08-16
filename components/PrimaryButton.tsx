import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { fonts } from '../constants/typography';
import { withPressedOpacity } from '../lib/pressedStyle';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
  backgroundColor?: string;
  textColor?: string;
}

/**
 * Couleurs par défaut = charte fixe des écrans d'auth (sign-in, sign-up),
 * seuls écrans restants hors thème (voir FormInput). Les autres écrans
 * (onboarding, task-create) passent colors.accent/accentContrast du thème
 * actif explicitement.
 */
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  backgroundColor = '#2F6FED',
  textColor = '#fff',
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor },
        variant === 'secondary' && [styles.secondary, { borderColor: backgroundColor }],
        isDisabled && styles.disabled,
        style,
        withPressedOpacity(pressed),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? backgroundColor : textColor} />
      ) : (
        <Text
          style={[styles.label, { color: variant === 'secondary' ? backgroundColor : textColor }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
});
