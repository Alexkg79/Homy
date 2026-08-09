import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

interface FormInputProps extends TextInputProps {
  label: string;
}

export function FormInput({ label, style, ...rest }: FormInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor="#9AA0A6"
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
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D4D9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
});
