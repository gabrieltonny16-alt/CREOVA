import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { requireSupabase } from '../../lib/supabase';

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'permission-denied' }
  | { status: 'unsupported' };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushDeviceStatus = 'enabled' | 'disabled' | 'unsupported' | 'setup-required';

export async function getThisDevicePushStatus(): Promise<PushDeviceStatus> {
  if (Platform.OS === 'web' || !Device.isDevice || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    return 'unsupported';
  }
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return 'setup-required';

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'disabled';
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  const { data: userData, error: userError } = await requireSupabase().auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return 'disabled';

  const { data, error } = await requireSupabase()
    .from('user_push_tokens')
    .select('id')
    .eq('user_id', userData.user.id)
    .eq('expo_push_token', tokenResult.data)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data ? 'enabled' : 'disabled';
}

export async function registerThisDeviceForPushNotifications(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web' || !Device.isDevice || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
    return { status: 'unsupported' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('creova-activity', {
      name: 'CREOVA activity',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#3985FF',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return { status: 'permission-denied' };
  }

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    throw new Error('CREOVA push setup needs its Expo EAS project ID before this device can register.');
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Sign in before enabling push notifications.');

  const { error } = await client
    .from('user_push_tokens')
    .upsert({
      user_id: userData.user.id,
      expo_push_token: tokenResult.data,
      platform: Platform.OS,
      device_name: Device.deviceName ?? Device.modelName ?? null,
      is_active: true,
      last_registered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'expo_push_token' });

  if (error) throw error;
  return { status: 'registered', token: tokenResult.data };
}

export async function disableThisDevicePushNotifications(): Promise<void> {
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || Platform.OS === 'web' || !Device.isDevice) return;

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await requireSupabase()
    .from('user_push_tokens')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('expo_push_token', tokenResult.data);

  if (error) throw error;
}

export function addPushNotificationResponseListener(
  onResponse: (data: Record<string, unknown>) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    onResponse(data && typeof data === 'object' ? data as Record<string, unknown> : {});
  });
}

export async function getInitialPushNotificationResponse(): Promise<Record<string, unknown> | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;
  const data = response.notification.request.content.data;
  return data && typeof data === 'object' ? data as Record<string, unknown> : {};
}
