import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorText } from '../../components/ErrorText';
import { FormInput } from '../../components/FormInput';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useGroupStore } from '../../hooks/useGroupStore';

type Mode = 'create' | 'join';

export default function Onboarding() {
  const [mode, setMode] = useState<Mode>('create');
  const [displayName, setDisplayName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

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
      // Redirection explicite plutôt que de compter uniquement sur la
      // logique centralisée de app/index.tsx : plus direct, et robuste même
      // si ce fix venait à régresser (cf. hooks/useGroupStore.ts, group.tsx
      // re-fetch de toute façon les membres au montage si hasFetched=false).
      router.replace('/(app)/group');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, mode === 'create' && styles.tabActive]}
            onPress={() => {
              setMode('create');
              clearError();
            }}
          >
            <Text style={[styles.tabLabel, mode === 'create' && styles.tabLabelActive]}>
              Créer un groupe
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'join' && styles.tabActive]}
            onPress={() => {
              setMode('join');
              clearError();
            }}
          >
            <Text style={[styles.tabLabel, mode === 'join' && styles.tabLabelActive]}>
              Rejoindre un groupe
            </Text>
          </Pressable>
        </View>

        <FormInput
          label="Ton prénom (visible par le groupe)"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

        {mode === 'create' ? (
          <FormInput
            label="Nom du groupe"
            value={groupName}
            onChangeText={setGroupName}
            autoCapitalize="words"
            placeholder="Ex: Maison Dupont"
          />
        ) : (
          <FormInput
            label="Code d'invitation"
            value={inviteCode}
            onChangeText={(text) => setInviteCode(text.toUpperCase())}
            autoCapitalize="characters"
            placeholder="Ex: AB23CD"
            maxLength={6}
          />
        )}

        <ErrorText>{error}</ErrorText>

        <PrimaryButton
          label={mode === 'create' ? 'Créer le groupe' : 'Rejoindre le groupe'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!canSubmit}
        />
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F5',
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
  tabActive: {
    backgroundColor: '#fff',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabLabelActive: {
    color: '#2F6FED',
  },
});
