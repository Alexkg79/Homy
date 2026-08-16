import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { FormInput } from '../../components/FormInput';
import { PrimaryButton } from '../../components/PrimaryButton';
import { fonts } from '../../constants/typography';
import { useAuthStore } from '../../hooks/useAuthStore';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useAuthStore((state) => state.signIn);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const handleSubmit = async () => {
    clearError();
    const success = await signIn(email.trim(), password);
    if (success) {
      router.replace('/');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Homy</Text>
        <Text style={styles.subtitle}>Connecte-toi pour retrouver ton groupe.</Text>

        <FormInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <FormInput
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        <ErrorText>{error}</ErrorText>

        <PrimaryButton
          label="Se connecter"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!email || !password}
        />

        <Link href="/(auth)/sign-up" style={styles.link}>
          <Text>
            Pas encore de compte ? <Text style={styles.linkText}>Inscris-toi</Text>
          </Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  link: {
    marginTop: 8,
    alignSelf: 'center',
  },
  linkText: {
    color: '#2F6FED',
    fontFamily: fonts.semiBold,
  },
});
