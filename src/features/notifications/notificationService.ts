import { requireSupabase } from '../../lib/supabase';

export type CreovaNotificationType =
  | 'follow_request'
  | 'new_follower'
  | 'follow_accepted'
  | 'post_like'
  | 'post_comment'
  | 'comment_reply'
  | 'post_repost';

export type CreovaNotification = {
  id: string;
  recipient_id: string;
  actor_id: string;
  notification_type: CreovaNotificationType;
  post_id: string | null;
  comment_id: string | null;
  created_at: string;
  read_at: string | null;
  actor: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type CreovaNotificationPreferences = {
  likes_enabled: boolean;
  comments_enabled: boolean;
  follows_enabled: boolean;
  reposts_enabled: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: CreovaNotificationPreferences = {
  likes_enabled: true,
  comments_enabled: true,
  follows_enabled: true,
  reposts_enabled: true,
};

const NOTIFICATION_TYPES_BY_PREFERENCE: Record<keyof CreovaNotificationPreferences, CreovaNotificationType[]> = {
  likes_enabled: ['post_like'],
  comments_enabled: ['post_comment', 'comment_reply'],
  follows_enabled: ['follow_request', 'new_follower', 'follow_accepted'],
  reposts_enabled: ['post_repost'],
};

export async function getMyNotificationPreferences(): Promise<CreovaNotificationPreferences> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Sign in to manage notification preferences.');

  const { data, error } = await client
    .from('notification_preferences')
    .select('likes_enabled, comments_enabled, follows_enabled, reposts_enabled')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error) throw error;
  return data
    ? data as CreovaNotificationPreferences
    : { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

export async function saveMyNotificationPreferences(
  preferences: CreovaNotificationPreferences,
): Promise<CreovaNotificationPreferences> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Sign in to manage notification preferences.');

  const { data, error } = await client
    .from('notification_preferences')
    .upsert({
      user_id: userData.user.id,
      ...preferences,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('likes_enabled, comments_enabled, follows_enabled, reposts_enabled')
    .single();

  if (error) throw error;
  return data as CreovaNotificationPreferences;
}

async function getEnabledNotificationTypes(): Promise<CreovaNotificationType[]> {
  const preferences = await getMyNotificationPreferences();
  return (Object.keys(NOTIFICATION_TYPES_BY_PREFERENCE) as (keyof CreovaNotificationPreferences)[])
    .filter(key => preferences[key])
    .flatMap(key => NOTIFICATION_TYPES_BY_PREFERENCE[key]);
}

const NOTIFICATION_SELECT = [
  'id',
  'recipient_id',
  'actor_id',
  'notification_type',
  'post_id',
  'comment_id',
  'created_at',
  'read_at',
  'actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)',
].join(', ');

export async function getMyNotifications(limit = 60): Promise<CreovaNotification[]> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Sign in to view your notifications.');
  const enabledTypes = await getEnabledNotificationTypes();
  if (enabledTypes.length === 0) return [];

  const { data, error } = await client
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('recipient_id', userData.user.id)
    .in('notification_type', enabledTypes)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) throw error;
  return (data ?? []) as unknown as CreovaNotification[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return 0;

  const enabledTypes = await getEnabledNotificationTypes();
  if (enabledTypes.length === 0) return 0;

  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userData.user.id)
    .in('notification_type', enabledTypes)
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Sign in to update your notifications.');

  const { error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userData.user.id)
    .is('read_at', null);

  if (error) throw error;
}

export function subscribeToMyNotifications(
  userId: string,
  onInsert: (notification: Partial<CreovaNotification>) => void,
  scope: 'inbox' | 'badge' = 'inbox',
) {
  const client = requireSupabase();
  return client
    .channel('creova-notifications-' + scope + '-' + userId)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'recipient_id=eq.' + userId,
      },
      payload => onInsert(payload.new as Partial<CreovaNotification>),
    )
    .subscribe();
}
