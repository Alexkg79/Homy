import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { callRpc } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Demande la permission notifications puis enregistre le push token Expo de
 * cet appareil pour l'utilisateur courant, via la RPC register_push_token
 * (upsert sur `token` côté serveur — pas un upsert direct côté client : un
 * device peut changer de main, ex: tablette familiale partagée, et RLS
 * bloquerait la réattribution d'une ligne dont le propriétaire actuel est
 * quelqu'un d'autre ; voir le commentaire de la migration correspondante).
 *
 * Ne jette jamais : simulateur/émulateur (pas de vrai push token, cf.
 * `Device.isDevice`), permission refusée, ou projet EAS pas encore lié sont
 * des cas attendus, loggés clairement plutôt que de crasher l'app.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    console.log('[notifications] Simulateur/émulateur détecté : pas de push token disponible.');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Permission notifications refusée.');
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    console.log(
      '[notifications] Pas de projectId EAS configuré (lance `eas init`) : impossible de récupérer un push token.'
    );
    return;
  }

  let token: string;
  try {
    const response = await Notifications.getExpoPushTokenAsync({ projectId });
    token = response.data;
  } catch (error) {
    console.log('[notifications] Échec de récupération du push token :', error);
    return;
  }

  const { error: rpcError } = await callRpc('register_push_token', { p_token: token });

  if (rpcError) {
    console.log("[notifications] Échec d'enregistrement du push token :", rpcError.message);
  }
}
