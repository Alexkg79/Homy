import { Ionicons } from '@expo/vector-icons';

export type TaskIconName = keyof typeof Ionicons.glyphMap;

/**
 * Icônes proposées à la création d'une tâche (remplace l'ancien champ emoji
 * texte libre). Une trentaine de choix courants pour des tâches
 * ménagères/familiales ; libellés utilisés comme accessibilityLabel dans la
 * grille de sélection (components/IconPickerField.tsx).
 */
export const TASK_ICONS: { name: TaskIconName; label: string }[] = [
  { name: 'trash-outline', label: 'Poubelle' },
  { name: 'restaurant-outline', label: 'Vaisselle' },
  { name: 'sparkles-outline', label: 'Ménage' },
  { name: 'shirt-outline', label: 'Linge' },
  { name: 'cart-outline', label: 'Courses' },
  { name: 'basket-outline', label: 'Panier' },
  { name: 'bag-outline', label: 'Sac' },
  { name: 'paw-outline', label: 'Animal' },
  { name: 'fish-outline', label: 'Nourrir animal' },
  { name: 'flame-outline', label: 'Cuisiner' },
  { name: 'water-outline', label: 'Salle de bain' },
  { name: 'leaf-outline', label: 'Jardin' },
  { name: 'flower-outline', label: 'Plantes' },
  { name: 'car-outline', label: 'Voiture' },
  { name: 'bicycle-outline', label: 'Vélo' },
  { name: 'school-outline', label: 'École' },
  { name: 'book-outline', label: 'Devoirs' },
  { name: 'receipt-outline', label: 'Factures' },
  { name: 'cash-outline', label: 'Argent' },
  { name: 'home-outline', label: 'Maison' },
  { name: 'bed-outline', label: 'Chambre' },
  { name: 'construct-outline', label: 'Bricolage' },
  { name: 'hammer-outline', label: 'Réparation' },
  { name: 'bulb-outline', label: 'Électricité' },
  { name: 'fitness-outline', label: 'Sport' },
  { name: 'game-controller-outline', label: 'Jeux' },
  { name: 'tv-outline', label: 'Salon' },
  { name: 'medkit-outline', label: 'Santé' },
  { name: 'gift-outline', label: 'Cadeaux' },
  { name: 'footsteps-outline', label: 'Entrée' },
  { name: 'star-outline', label: 'Générique (étoile)' },
  { name: 'checkmark-circle-outline', label: 'Générique (coché)' },
  { name: 'heart-outline', label: 'Générique (cœur)' },
];

const TASK_ICON_NAMES = new Set<string>(TASK_ICONS.map((i) => i.name));

/**
 * Distingue un nom d'icône Ionicons (nouveau format) d'un emoji brut stocké
 * par des tâches créées avant l'introduction du picker — voir TaskIcon.tsx,
 * qui affiche l'un ou l'autre selon ce test plutôt que de migrer les données
 * existantes.
 */
export function isTaskIconName(value: string): value is TaskIconName {
  return TASK_ICON_NAMES.has(value);
}
