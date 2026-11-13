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

  const { data, error } = await client
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('recipient_id', userData.user.id)
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

  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userData.user.id)
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
