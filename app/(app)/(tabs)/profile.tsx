import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorText } from '../../../components/ErrorText';
import { FormInput } from '../../../components/FormInput';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { fonts } from '../../../constants/typography';
import { useAuthStore } from '../../../hooks/useAuthStore';
import { useGroupStore } from '../../../hooks/useGroupStore';
import { useTaskStore } from '../../../hooks/useTaskStore';
import { useTheme } from '../../../hooks/useTheme';
import type { ThemePreference } from '../../../hooks/useThemeStore';
import { withPressedOpacity } from '../../../lib/pressedStyle';
import { computeOnTimeStats, computeOnTimeStreak } from '../../../lib/stats';

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'Clair', value: 'light' },
  { label: 'Sombre', value: 'dark' },
];

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors, preference, setPreference } = useTheme();
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);

  const groups = useGroupStore((state) => state.groups);
  const activeGroupId = useGroupStore((state) => state.activeGroupId);
  const membersByGroupId = useGroupStore((state) => state.membersByGroupId);
  const groupError = useGroupStore((state) => state.error);
  const isSubmittingName = useGroupStore((state) => state.isSubmitting);
  const updateDisplayName = useGroupStore((state) => state.updateDisplayName);

  const instances = useTaskStore((state) => state.instances);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);

  // "Nom affiché" édite le nom dans le groupe actif : display_name est une
  // colonne par ligne group_members (potentiellement différente d'un groupe
  // à l'autre pour une même personne), pas un nom global.
  const activeGroupMembers = useMemo(
    () => (activeGroupId ? (membersByGroupId[activeGroupId] ?? []) : []),
    [membersByGroupId, activeGroupId]
  );
  const me = useMemo(
    () => activeGroupMembers.find((m) => m.user_id === session?.user.id),
    [activeGroupMembers, session]
  );

  const [nameInput, setNameInput] = useState(me?.display_name ?? '');

  useEffect(() => {
    setNameInput(me?.display_name ?? '');
  }, [me?.display_name]);

  useFocusEffect(
    useCallback(() => {
      if (groups.length > 0) {
        fetchTasks(groups.map((g) => g.id));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups])
  );

  if (!session || !me) {
    return <LoadingScreen />;
  }

  // Stats globales (tous groupes confondus), pas scopées au groupe actif :
  // `instances` contient déjà tous les groupes de l'utilisateur par
  // construction (useTaskStore), donc aucun filtre supplémentaire n'est
  // nécessaire ici — cohérent avec Accueil qui affiche aussi tout agrégé.
  const personalInstances = instances.filter((i) => i.assigned_to === session.user.id);
  const totalCompleted = personalInstances.filter((i) => i.status === 'terminee').length;
  const weekStats = computeOnTimeStats(personalInstances);
  const streak = computeOnTimeStreak(personalInstances);

  const nameChanged = nameInput.trim().length > 0 && nameInput.trim() !== me.display_name;

  const handleSaveName = () => {
    if (!nameChanged || !activeGroupId) return;
    updateDisplayName(session.user.id, activeGroupId, nameInput.trim());
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Profil</Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>Email</Text>
        <Text style={[styles.emailValue, { color: colors.textMuted }]}>{session.user.email}</Text>
      </View>

      <View style={styles.field}>
        <FormInput
          label="Nom affiché"
          value={nameInput}
          onChangeText={setNameInput}
          autoCapitalize="words"
          labelColor={colors.textPrimary}
          borderColor={colors.border}
          backgroundColor={colors.inputBackground}
          textColor={colors.textPrimary}
          placeholderColor={colors.placeholder}
        />
        {nameChanged && (
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: colors.accent },
              isSubmittingName && styles.saveBtnDisabled,
              withPressedOpacity(pressed),
            ]}
            onPress={handleSaveName}
            disabled={isSubmittingName}
          >
            <Text style={[styles.saveLabel, { color: colors.accentContrast }]}>Enregistrer</Text>
          </Pressable>
        )}
        <ErrorText color={colors.danger}>{groupError}</ErrorText>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>Apparence</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={({ pressed }) => [
                styles.themeChip,
                { backgroundColor: colors.backgroundMuted },
                preference === opt.value && { backgroundColor: colors.accent },
                withPressedOpacity(pressed),
              ]}
              onPress={() => setPreference(opt.value)}
            >
              <Text
                style={[
                  styles.themeChipLabel,
                  { color: colors.textMuted },
                  preference === opt.value && { color: colors.accentContrast },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{totalCompleted}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Terminées</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {weekStats.onTimeRate !== null ? `${Math.round(weekStats.onTimeRate * 100)}%` : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>À l&apos;heure (semaine)</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>🔥 {streak}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Jours sans retard</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOutBtn, { borderColor: colors.border }, withPressedOpacity(pressed)]}
        onPress={signOut}
      >
        <Text style={[styles.signOutLabel, { color: colors.textPrimary }]}>Déconnexion</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 20,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.bold,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  emailValue: {
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  saveBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  themeChipLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: fonts.bold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  signOutBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  signOutLabel: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
});
