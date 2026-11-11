import { requireSupabase } from '../../lib/supabase';

export type MessageParticipant = {
  user_id: string;
  role: 'admin' | 'member';
  membership_status: 'accepted' | 'pending' | 'declined' | 'left';
  profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type CreovaMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_message_id: string;
  body: string;
  created_at: string;
  sender: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type CreovaConversation = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
  membershipStatus: 'accepted' | 'pending';
  lastReadAt: string;
  participants: MessageParticipant[];
  lastMessage: CreovaMessage | null;
  unreadCount: number;
};

function makeUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, token => {
    const random = Math.random() * 16 | 0;
    return (token === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
  });
}

export async function getMyConversations(): Promise<CreovaConversation[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view your messages.');

  const { data: membershipRows, error } = await client
    .from('conversation_members')
    .select('conversation_id, membership_status, last_read_at, conversation:conversations!inner(id, kind, title, created_by, created_at, last_message_at)')
    .eq('user_id', auth.user.id)
    .in('membership_status', ['accepted', 'pending']);
  if (error) throw error;

  const memberships = (membershipRows ?? []).map((row: any) => ({
    ...row,
    conversation: Array.isArray(row.conversation) ? row.conversation[0] : row.conversation,
  })).filter((row: any) => row.conversation);
  const ids = memberships.map((row: any) => row.conversation_id as string);
  if (!ids.length) return [];

  const [memberResult, messageResult] = await Promise.all([
    client.from('conversation_members')
      .select('conversation_id, user_id, role, membership_status, profile:profiles!conversation_members_user_id_fkey(username, display_name, avatar_url)')
      .in('conversation_id', ids),
    client.from('conversation_messages')
      .select('id, conversation_id, sender_id, client_message_id, body, created_at, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);
  if (memberResult.error) throw memberResult.error;
  if (messageResult.error) throw messageResult.error;

  const membersByConversation = new Map<string, MessageParticipant[]>();
  for (const row of memberResult.data ?? []) {
    const participant = {
      ...row,
      profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
    } as MessageParticipant;
    const list = membersByConversation.get(row.conversation_id) ?? [];
    list.push(participant);
    membersByConversation.set(row.conversation_id, list);
  }

  const latestMessageByConversation = new Map<string, CreovaMessage>();
  for (const row of messageResult.data ?? []) {
    if (!latestMessageByConversation.has(row.conversation_id)) {
      latestMessageByConversation.set(row.conversation_id, {
        ...row,
        sender: Array.isArray(row.sender) ? row.sender[0] : row.sender,
      } as CreovaMessage);
    }
  }

  const unreadCounts = await Promise.all(memberships.map(async (membership: any) => {
    const query = client.from('conversation_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', membership.conversation_id)
      .neq('sender_id', auth.user.id);
    const result = membership.last_read_at
      ? await query.gt('created_at', membership.last_read_at)
      : await query;
    if (result.error) throw result.error;
    return [membership.conversation_id, result.count ?? 0] as const;
  }));
  const unreadByConversation = new Map(unreadCounts);

  return memberships.map((membership: any) => ({
    ...membership.conversation,
    membershipStatus: membership.membership_status,
    lastReadAt: membership.last_read_at,
    participants: membersByConversation.get(membership.conversation_id) ?? [],
    lastMessage: latestMessageByConversation.get(membership.conversation_id) ?? null,
    unreadCount: unreadByConversation.get(membership.conversation_id) ?? 0,
  })).sort((left: CreovaConversation, right: CreovaConversation) =>
    new Date(right.last_message_at).getTime() - new Date(left.last_message_at).getTime()
  );
}

export async function getConversationMessages(conversationId: string): Promise<CreovaMessage[]> {
  const { data, error } = await requireSupabase()
    .from('conversation_messages')
    .select('id, conversation_id, sender_id, client_message_id, body, created_at, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    sender: Array.isArray(row.sender) ? row.sender[0] : row.sender,
  })) as CreovaMessage[];
}

export async function createConversation(input: {
  kind: 'direct' | 'group';
  memberIds: string[];
  title?: string;
}): Promise<string> {
  const { data, error } = await requireSupabase().rpc('creova_create_conversation', {
    p_kind: input.kind,
    p_member_ids: input.memberIds,
    p_title: input.title?.trim() || null,
  });
  if (error) throw error;
  if (!data) throw new Error('The conversation could not be created.');
  return data as string;
}

export function createMessageClientId(): string {
  return makeUuid();
}

export async function sendMessage(conversationId: string, body: string, clientMessageId = makeUuid()): Promise<CreovaMessage> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to send a message.');
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Write a message first.');
  if (trimmed.length > 5000) throw new Error('Messages must be 5,000 characters or fewer.');

  const { data, error } = await client.from('conversation_messages').insert({
    conversation_id: conversationId,
    sender_id: auth.user.id,
    client_message_id: clientMessageId,
    body: trimmed,
  }).select('id, conversation_id, sender_id, client_message_id, body, created_at, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)').single();
  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: existingError } = await client.from('conversation_messages')
        .select('id, conversation_id, sender_id, client_message_id, body, created_at, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)')
        .eq('sender_id', auth.user.id)
        .eq('client_message_id', clientMessageId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        return {
          ...existing,
          sender: Array.isArray(existing.sender) ? existing.sender[0] : existing.sender,
        } as CreovaMessage;
      }
    }
    throw error;
  }
  return {
    ...data,
    sender: Array.isArray(data.sender) ? data.sender[0] : data.sender,
  } as CreovaMessage;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to update read status.');
  const { error } = await client.from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id)
    .in('membership_status', ['accepted', 'pending']);
  if (error) throw error;
}

export async function respondToMessageRequest(conversationId: string, accept: boolean): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to respond to a message request.');
  const now = new Date().toISOString();
  const { data, error } = await client.from('conversation_members')
    .update({
      membership_status: accept ? 'accepted' : 'declined',
      accepted_at: accept ? now : null,
      last_read_at: now,
    })
    .eq('conversation_id', conversationId)
    .eq('user_id', auth.user.id)
    .eq('membership_status', 'pending')
    .select('conversation_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This message request is no longer available.');
}

export async function getCurrentMessagingUserId(): Promise<string> {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in to use messages.');
  return data.user.id;
}

export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (message: CreovaMessage) => void,
  onStatus?: (status: string) => void,
): () => void {
  const client = requireSupabase();
  const channel = client.channel(`conversation:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'conversation_messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, payload => {
      const row = payload.new as any;
      onMessage({
        id: row.id,
        conversation_id: row.conversation_id,
        sender_id: row.sender_id,
        client_message_id: row.client_message_id,
        body: row.body,
        created_at: row.created_at,
        sender: null,
      });
    })
    .subscribe(status => onStatus?.(status));
  return () => { void client.removeChannel(channel); };
}

export function subscribeToInboxChanges(
  onMessagesChange: () => void,
  onMembershipChange: () => void,
  onNotificationsChange: () => void,
): () => void {
  const client = requireSupabase();
  const channel = client.channel('creova:inbox-updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversation_messages',
    }, onMessagesChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversation_members',
    }, onMembershipChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
    }, onNotificationsChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
