import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { FormInput } from '../../components/FormInput';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useAuthStore } from '../../hooks/useAuthStore';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmEmailMessage, setConfirmEmailMessage] = useState<string | null>(null);
  const signUp = useAuthStore((state) => state.signUp);
  const isSubmitting = useAuthStore((state) => state.isSubmitting);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const handleSubmit = async () => {
    clearError();
    setConfirmEmailMessage(null);

    if (password.length < 6) {
      return;
    }

    const result = await signUp(email.trim(), password);

    if (result === 'signed_in') {
      router.replace('/');
    } else if (result === 'confirm_email') {
      setConfirmEmailMessage('Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>Rejoins ou crée ton groupe en quelques secondes.</Text>

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
          textContentType="newPassword"
        />

        {password.length > 0 && password.length < 6 && (
          <ErrorText>Le mot de passe doit contenir au moins 6 caractères.</ErrorText>
        )}
        <ErrorText>{error}</ErrorText>
        {confirmEmailMessage && <Text style={styles.info}>{confirmEmailMessage}</Text>}

        <PrimaryButton
          label="S'inscrire"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!email || password.length < 6}
        />

        <Link href="/(auth)/sign-in" style={styles.link}>
          <Text>
            Déjà un compte ? <Text style={styles.linkText}>Connecte-toi</Text>
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
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  info: {
    color: '#2F6FED',
    fontSize: 14,
  },
  link: {
    marginTop: 8,
    alignSelf: 'center',
  },
  linkText: {
    color: '#2F6FED',
    fontWeight: '600',
  },
});
