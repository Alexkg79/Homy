/**
 * Une seule famille (Plus Jakarta Sans) déclinée en 4 graisses. Les fonts
 * custom ignorent `fontWeight` en RN — chaque style doit donc pointer
 * explicitement vers la bonne variante ici plutôt que déclarer fontWeight.
 */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;
