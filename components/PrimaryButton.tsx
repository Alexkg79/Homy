import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        variant === 'secondary' && styles.secondary,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#2F6FED' : '#fff'} />
      ) : (
        <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#2F6FED',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2F6FED',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryLabel: {
    color: '#2F6FED',
  },
});
