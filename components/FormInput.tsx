import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

interface FormInputProps extends TextInputProps {
  label: string;
  labelColor?: string;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  placeholderColor?: string;
}

/**
 * Couleurs par défaut = charte fixe des écrans d'auth (sign-in, sign-up),
 * seuls écrans restants hors thème. Tous les autres écrans (tabs, onboarding,
 * task-create) passent les couleurs du thème actif explicitement (voir
 * RecurringTaskEditor, profile.tsx) pour suivre le mode clair/sombre sans
 * dupliquer la lecture du thème ici.
 */
export function FormInput({
  label,
  style,
  labelColor = '#333',
  borderColor = '#D0D4D9',
  backgroundColor = '#fff',
  textColor = '#111',
  placeholderColor = '#9AA0A6',
  ...rest
}: FormInputProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor, backgroundColor, color: textColor }, style]}
        placeholderTextColor={placeholderColor}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});
