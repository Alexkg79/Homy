import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface PickerFieldProps {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
  labelColor?: string;
  borderColor?: string;
  backgroundColor?: string;
  valueColor?: string;
}

/**
 * Champ date/heure natif. Sur Android, DateTimePicker n'existe qu'en mode
 * impératif (DateTimePickerAndroid.open ouvre le dialog système) ; sur iOS on
 * affiche le composant en inline (display="spinner") sous un bouton qui
 * bascule sa visibilité. Pas de mode "datetime" combiné : Android ne le
 * supporte pas nativement, donc date et heure restent deux champs séparés
 * pour un comportement cohérent sur les deux plateformes.
 *
 * Couleurs par défaut = charte fixe de secours (non utilisée par les écrans
 * actuels : tous les écrans avec PickerField sont thémés). Les écrans passent
 * les couleurs du thème actif explicitement (voir RecurringTaskEditor,
 * TaskInstanceCard, task-create) pour suivre le mode clair/sombre.
 */
export function PickerField({
  label,
  value,
  mode,
  onChange,
  labelColor = '#333',
  borderColor = '#D0D4D9',
  backgroundColor = '#fff',
  valueColor = '#111',
}: PickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handlePress = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        is24Hour: true,
        onChange: (_event, selected) => {
          if (selected) onChange(selected);
        },
      });
    } else {
      setShowPicker((current) => !current);
    }
  };

  const displayValue =
    mode === 'date'
      ? value.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <Pressable style={[styles.button, { borderColor, backgroundColor }]} onPress={handlePress}>
        <Text style={[styles.buttonLabel, { color: valueColor }]}>{displayValue}</Text>
      </Pressable>
      {Platform.OS === 'ios' && showPicker && (
        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          is24Hour
          onChange={(_event, selected) => {
            if (selected) onChange(selected);
          }}
        />
      )}
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
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buttonLabel: {
    fontSize: 16,
  },
});
