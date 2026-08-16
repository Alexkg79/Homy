import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useGroupStore } from '../hooks/useGroupStore';
import { useTheme } from '../hooks/useTheme';

interface GroupSwitcherHeaderProps {
  /** Chaque écran garde son offset de safe-area actuel (insets.top + X). */
  paddingTop: number;
  /** Contenu affiché à droite du header (cloche + bouton "+" sur Accueil). */
  trailing?: ReactNode;
}

/**
 * Header partagé Accueil/Tâches/Groupe : nom du groupe actif + chevron,
 * ouvre une modale listant tous les groupes de l'utilisateur pour changer de
 * groupe actif, avec une entrée "Rejoindre/Créer un groupe" toujours
 * accessible (réutilise l'écran onboarding, poussé plutôt que remplacé donc
 * avec un bouton retour natif).
 */
export function GroupSwitcherHeader({ paddingTop, trailing }: GroupSwitcherHeaderProps) {
  const { colors } = useTheme();
  const groups = useGroupStore((state) => state.groups);
  const activeGroupId = useGroupStore((state) => state.activeGroupId);
  const setActiveGroup = useGroupStore((state) => state.setActiveGroup);
  const [open, setOpen] = useState(false);

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  const handleSelect = (groupId: string) => {
    setOpen(false);
    setActiveGroup(groupId);
  };

  const handleAddGroup = () => {
    setOpen(false);
    router.push('/(app)/onboarding');
  };

  return (
    <View style={[styles.header, { paddingTop, borderBottomColor: colors.border }]}>
      <View style={styles.triggerColumn}>
        <Text style={[styles.brand, { color: colors.textMuted }]}>HOMY</Text>
        <Pressable style={styles.trigger} onPress={() => setOpen(true)} hitSlop={8}>
          <View style={[styles.avatar, { backgroundColor: colors.backgroundMuted }]}>
            <Text style={[styles.avatarInitial, { color: colors.accent }]}>
              {activeGroup?.name.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={[styles.groupName, { color: colors.textPrimary }]} numberOfLines={1}>
            {activeGroup?.name ?? '—'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      {trailing}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.panel,
              { top: paddingTop + 52, backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => {}}
          >
            {groups.map((g) => (
              <Pressable
                key={g.id}
                style={styles.row}
                onPress={() => handleSelect(g.id)}
              >
                <View style={[styles.avatar, { backgroundColor: colors.backgroundMuted }]}>
                  <Text style={[styles.avatarInitial, { color: colors.accent }]}>
                    {g.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                  {g.name}
                </Text>
                {g.id === activeGroupId && (
                  <Ionicons name="checkmark" size={18} color={colors.accent} />
                )}
              </Pressable>
            ))}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable style={styles.row} onPress={handleAddGroup}>
              <View style={[styles.avatar, { backgroundColor: colors.backgroundMuted }]}>
                <Ionicons name="add" size={18} color={colors.accent} />
              </View>
              <Text style={[styles.rowLabel, { color: colors.accent }]}>
                Rejoindre / Créer un groupe
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
  },
  triggerColumn: {
    gap: 2,
    flexShrink: 1,
  },
  brand: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '700',
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderWidth: 0.5,
    borderRadius: 12,
    paddingVertical: 6,
    maxHeight: '60%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  divider: {
    height: 0.5,
    marginVertical: 4,
    marginHorizontal: 12,
  },
});
