import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';

import { isTaskIconName } from '../constants/taskIcons';

interface TaskIconProps {
  icon: string;
  size: number;
  color: string;
}

/**
 * Affiche task.icon : nom Ionicons pour les tâches créées via le picker, ou
 * emoji brut tel quel pour les tâches créées avant son introduction (pas de
 * migration de données, les deux formats coexistent indéfiniment).
 */
export function TaskIcon({ icon, size, color }: TaskIconProps) {
  if (isTaskIconName(icon)) {
    return <Ionicons name={icon} size={size} color={color} />;
  }
  return <Text style={{ fontSize: size }}>{icon || '•'}</Text>;
}
