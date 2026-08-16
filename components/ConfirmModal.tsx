import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts } from '../constants/typography';
import { useTheme } from '../hooks/useTheme';
import { ActionButton, type ActionVariant } from './ActionButton';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ActionVariant;
  confirmIcon?: keyof typeof Ionicons.glyphMap;
  cancelIcon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modale de confirmation générique (titre + message optionnel + 2 boutons
 * ActionButton), pas hardcodée pour "terminer une tâche" : réutilisable pour
 * toute confirmation future via les props. Même langage visuel que le reste
 * de l'app (panel façon IconPickerField, boutons façon TaskInstanceCard).
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  confirmVariant = 'filled',
  confirmIcon = 'checkmark-circle',
  cancelIcon = 'close-outline',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useTheme();
  // Fade + scale léger à l'apparition (le fade de sortie natif du Modal
  // suffit à la fermeture, cohérent avec IconPickerField/GroupSwitcherHeader
  // qui utilisent déjà animationType="fade").
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.92);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, scale]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <AnimatedPressable
          onPress={() => {}}
          style={[
            styles.panel,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {message && (
            <Text style={[styles.message, { color: colors.textMuted }]} numberOfLines={2}>
              {message}
            </Text>
          )}
          <View style={styles.actions}>
            <View style={styles.actionWrap}>
              <ActionButton
                label={confirmLabel}
                icon={confirmIcon}
                variant={confirmVariant}
                onPress={onConfirm}
                colors={colors}
              />
            </View>
            <View style={styles.actionWrap}>
              <ActionButton
                label={cancelLabel}
                icon={cancelIcon}
                variant="outline"
                onPress={onCancel}
                colors={colors}
              />
            </View>
          </View>
        </AnimatedPressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 0.5,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
  message: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    alignSelf: 'stretch',
  },
  actionWrap: {
    flex: 1,
  },
});
