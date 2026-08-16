import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { TASK_ICONS, type TaskIconName } from '../constants/taskIcons';
import type { ThemeColors } from '../constants/theme';
import { fonts } from '../constants/typography';
import { withPressedOpacity } from '../lib/pressedStyle';

interface IconPickerFieldProps {
  label: string;
  value: TaskIconName | '';
  onChange: (icon: TaskIconName) => void;
  colors: ThemeColors;
}

const NUM_COLUMNS = 5;

/**
 * Remplace l'ancien champ emoji texte libre : grille interne de ~30 icônes
 * Ionicons prédéfinies (constants/taskIcons.ts), pas d'accès à la galerie
 * photo. Prend `colors` en un bloc plutôt que des props color individuelles
 * (comme FormInput/PickerField) vu le nombre de surfaces à thémer dans la
 * modale (fond, bordure, cellules sélectionnées/non sélectionnées).
 */
export function IconPickerField({ label, value, onChange, colors }: IconPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = TASK_ICONS.find((i) => i.name === value);

  const handleSelect = (name: TaskIconName) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors.border, backgroundColor: colors.inputBackground },
          withPressedOpacity(pressed),
        ]}
        onPress={() => setOpen(true)}
      >
        {selected ? (
          <>
            <Ionicons name={selected.name} size={22} color={colors.accent} />
            <Text style={[styles.buttonLabel, { color: colors.textPrimary }]}>
              {selected.label}
            </Text>
          </>
        ) : (
          <Text style={[styles.buttonLabel, { color: colors.placeholder }]}>
            Choisir une icône
          </Text>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>
              Choisir une icône
            </Text>
            <FlatList
              data={TASK_ICONS}
              keyExtractor={(item) => item.name}
              numColumns={NUM_COLUMNS}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => {
                const isSelected = item.name === value;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.iconCell,
                      { backgroundColor: colors.backgroundMuted },
                      isSelected && { backgroundColor: colors.accent },
                      withPressedOpacity(pressed),
                    ]}
                    onPress={() => handleSelect(item.name)}
                    accessibilityLabel={item.label}
                  >
                    <Ionicons
                      name={item.name}
                      size={22}
                      color={isSelected ? colors.accentContrast : colors.textPrimary}
                    />
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buttonLabel: {
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    width: '88%',
    maxHeight: '70%',
    borderWidth: 0.5,
    borderRadius: 16,
    padding: 16,
  },
  panelTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    marginBottom: 12,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  iconCell: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
