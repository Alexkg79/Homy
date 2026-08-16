import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorText } from '../../components/ErrorText';
import { FormInput } from '../../components/FormInput';
import { ModalHeader } from '../../components/ModalHeader';
import { PrimaryButton } from '../../components/PrimaryButton';
import { fonts } from '../../constants/typography';
import { useGroupStore } from '../../hooks/useGroupStore';
import { useTheme } from '../../hooks/useTheme';
import { withPressedOpacity } from '../../lib/pressedStyle';

type Mode = 'create' | 'join';

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('create');
  const [displayName, setDisplayName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const groups = useGroupStore((state) => state.groups);
  const createGroup = useGroupStore((state) => state.createGroup);
  const joinGroup = useGroupStore((state) => state.joinGroup);
  const isSubmitting = useGroupStore((state) => state.isSubmitting);
  const error = useGroupStore((state) => state.error);
  const clearError = useGroupStore((state) => state.clearError);

  const canSubmit =
    displayName.trim().length > 0 &&
    (mode === 'create' ? groupName.trim().length > 0 : inviteCode.trim().length > 0);

  const handleSubmit = async () => {
    clearError();
    const success =
      mode === 'create'
        ? await createGroup(groupName, displayName)
        : await joinGroup(inviteCode, displayName);

    if (success) {
      // Deux points d'entrée possibles désormais : gate initial (zéro
      // groupe, "/(app)/onboarding" remplace "/" dans l'historique, donc pas
      // de retour possible) ou ouvert depuis le sélecteur de groupe alors
      // qu'on a déjà au moins un groupe (poussé par-dessus les tabs, donc un
      // retour existe). Même pattern de navigation impérative que le reste
      // de l'app, pas de <Redirect>.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(app)/(tabs)');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ModalHeader
        title={groups.length > 0 ? 'Ajouter un groupe' : 'Rejoindre un groupe'}
        paddingTop={insets.top + 16}
      />
      <View style={styles.content}>
        <View style={[styles.tabs, { backgroundColor: colors.backgroundMuted }]}>
          <Pressable
            style={({ pressed }) => [
              styles.tab,
              mode === 'create' && { backgroundColor: colors.card },
              withPressedOpacity(pressed),
            ]}
            onPress={() => {
              setMode('create');
              clearError();
            }}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: colors.textMuted },
                mode === 'create' && { color: colors.accent },
              ]}
            >
              Créer un groupe
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.tab,
              mode === 'join' && { backgroundColor: colors.card },
              withPressedOpacity(pressed),
            ]}
            onPress={() => {
              setMode('join');
              clearError();
            }}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: colors.textMuted },
                mode === 'join' && { color: colors.accent },
              ]}
            >
              Rejoindre un groupe
            </Text>
          </Pressable>
        </View>

        <FormInput
          label="Ton prénom (visible par le groupe)"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          labelColor={colors.textPrimary}
          borderColor={colors.border}
          backgroundColor={colors.inputBackground}
          textColor={colors.textPrimary}
          placeholderColor={colors.placeholder}
        />

        {mode === 'create' ? (
          <FormInput
            label="Nom du groupe"
            value={groupName}
            onChangeText={setGroupName}
            autoCapitalize="words"
            placeholder="Ex: Maison Dupont"
            labelColor={colors.textPrimary}
            borderColor={colors.border}
            backgroundColor={colors.inputBackground}
            textColor={colors.textPrimary}
            placeholderColor={colors.placeholder}
          />
        ) : (
          <FormInput
            label="Code d'invitation"
            value={inviteCode}
            onChangeText={(text) => setInviteCode(text.toUpperCase())}
            autoCapitalize="characters"
            placeholder="Ex: AB23CD"
            maxLength={6}
            labelColor={colors.textPrimary}
            borderColor={colors.border}
            backgroundColor={colors.inputBackground}
            textColor={colors.textPrimary}
            placeholderColor={colors.placeholder}
          />
        )}

        <ErrorText color={colors.danger}>{error}</ErrorText>

        <PrimaryButton
          label={mode === 'create' ? 'Créer le groupe' : 'Rejoindre le groupe'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!canSubmit}
          backgroundColor={colors.accent}
          textColor={colors.accentContrast}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
});
