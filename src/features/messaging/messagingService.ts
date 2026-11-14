import type { RealtimeChannel } from '@supabase/supabase-js';
import { requireSupabase } from '../../lib/supabase';

export type ConversationMember = {
  user_id: string;
  membership_status: 'accepted' | 'pending' | 'declined' | 'left';
  role: 'admin' | 'member';
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type ConversationPreview = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
  members: ConversationMember[];
  latestMessage: {
    id: string;
    sender_id: string;
    body: string | null;
    created_at: string;
    deleted_at: string | null;
  } | null;
  myMembership: ConversationMember['membership_status'];
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  attachment_type: 'image' | 'video' | 'audio' | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_size: number | null;
  attachment_duration_ms: number | null;
  sender: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  reactions: { user_id: string; emoji: string }[];
};

type RawConversation = Omit<ConversationPreview, 'latestMessage' | 'myMembership'> & {
  members: ConversationMember[];
};

const MAX_MESSAGE_LENGTH = 5000;

async function getViewerId(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in to use messages.');
  return data.user.id;
}

export async function getMyConversations(): Promise<ConversationPreview[]> {
  const client = requireSupabase();
  const viewerId = await getViewerId();

  const { data: memberships, error: membershipError } = await client
    .from('conversation_members')
    .select('conversation_id, membership_status')
    .eq('user_id', viewerId)
    .in('membership_status', ['accepted', 'pending']);

  if (membershipError) throw membershipError;
  const conversationIds = (memberships ?? []).map(row => row.conversation_id);
  if (!conversationIds.length) return [];

  const { data, error } = await client
    .from('conversations')
    .select(`
      id, kind, title, created_by, created_at, last_message_at,
      members:conversation_members(
        user_id, membership_status, role,
        profile:profiles!conversation_members_user_id_fkey(id, username, display_name, avatar_url)
      )
    `)
    .in('id', conversationIds)
    .order('last_message_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  const rows = (data ?? []) as unknown as RawConversation[];
  if (!rows.length) return [];

  const { data: messageRows, error: messagesError } = await client
    .from('conversation_messages')
    .select('id, conversation_id, sender_id, body, created_at, deleted_at')
    .in('conversation_id', rows.map(row => row.id))
    .order('created_at', { ascending: false })
    .limit(Math.min(rows.length * 5, 250));

  if (messagesError) throw messagesError;

  const latestByConversation = new Map<string, ConversationPreview['latestMessage']>();
  for (const message of messageRows ?? []) {
    if (!latestByConversation.has(message.conversation_id)) {
      latestByConversation.set(message.conversation_id, {
        id: message.id,
        sender_id: message.sender_id,
        body: message.body,
        created_at: message.created_at,
        deleted_at: message.deleted_at,
      });
    }
  }

  const membershipByConversation = new Map(
    (memberships ?? []).map(row => [row.conversation_id, row.membership_status]),
  );

  return rows.map(row => ({
    ...row,
    latestMessage: latestByConversation.get(row.id) ?? null,
    myMembership: membershipByConversation.get(row.id) ?? 'left',
  }));
}

export async function getConversationMessages(
  conversationId: string,
  limit = 100,
): Promise<ConversationMessage[]> {
  const client = requireSupabase();
  await getViewerId();

  const { data, error } = await client
    .from('conversation_messages')
    .select(`
      id, conversation_id, sender_id, body, created_at, edited_at, deleted_at,
      attachment_type, attachment_path, attachment_name, attachment_mime_type,
      attachment_size, attachment_duration_ms,
      sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url),
      reactions:conversation_message_reactions(user_id, emoji)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) throw error;
  // Fetch the newest page first, then display it in chronological order.
  return ((data ?? []).reverse()) as unknown as ConversationMessage[];
}

export async function sendTextMessage(conversationId: string, body: string): Promise<void> {
  const client = requireSupabase();
  const senderId = await getViewerId();
  const cleanBody = body.trim();

  if (!cleanBody) throw new Error('Write a message first.');
  if (cleanBody.length > MAX_MESSAGE_LENGTH) {
    throw new Error('Messages can be up to 5,000 characters.');
  }

  const { error } = await client.from('conversation_messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: cleanBody,
  });

  if (error) throw error;
}

export async function startDirectConversation(
  recipientId: string,
  firstMessage: string,
): Promise<string> {
  const client = requireSupabase();
  const viewerId = await getViewerId();
  const cleanMessage = firstMessage.trim();

  if (!recipientId || recipientId === viewerId) {
    throw new Error('Choose another CREOVA member.');
  }
  if (!cleanMessage) throw new Error('Write a message before starting a conversation.');
  if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
    throw new Error('Messages can be up to 5,000 characters.');
  }

  const { data, error } = await client.rpc('creova_create_conversation', {
    p_kind: 'direct',
    p_member_ids: [viewerId, recipientId],
    p_title: null,
  });

  if (error) throw error;
  if (typeof data !== 'string') throw new Error('CREOVA could not create this conversation.');

  await sendTextMessage(data, cleanMessage);
  return data;
}

export async function acceptConversationRequest(conversationId: string): Promise<void> {
  const client = requireSupabase();
  const viewerId = await getViewerId();
  const { data, error } = await client
    .from('conversation_members')
    .update({
      membership_status: 'accepted',
      accepted_at: new Date().toISOString(),
      joined_at: new Date().toISOString(),
    })
    .eq('conversation_id', conversationId)
    .eq('user_id', viewerId)
    .eq('membership_status', 'pending')
    .select('conversation_id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('This message request is no longer pending.');
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const client = requireSupabase();
  const viewerId = await getViewerId();
  const { error } = await client
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', viewerId)
    .eq('membership_status', 'accepted');

  if (error) throw error;
}

export async function editConversationMessage(messageId: string, body: string): Promise<void> {
  const client = requireSupabase();
  await getViewerId();
  const cleanBody = body.trim();
  if (!cleanBody || cleanBody.length > MAX_MESSAGE_LENGTH) {
    throw new Error('Messages must contain 1 to 5,000 characters.');
  }
  const { error } = await client.rpc('creova_edit_conversation_message', {
    p_message_id: messageId,
    p_body: cleanBody,
  });
  if (error) throw error;
}

export async function deleteConversationMessage(messageId: string): Promise<void> {
  const client = requireSupabase();
  await getViewerId();
  const { error } = await client.rpc('creova_delete_conversation_message', {
    p_message_id: messageId,
  });
  if (error) throw error;
}

export async function setConversationMessageReaction(
  conversationId: string,
  messageId: string,
  emoji: '❤️' | '😂' | '😮' | '😢' | '👍' | '🔥',
): Promise<void> {
  const client = requireSupabase();
  const viewerId = await getViewerId();
  const { data: existing, error: lookupError } = await client
    .from('conversation_message_reactions')
    .select('id, emoji')
    .eq('message_id', messageId)
    .eq('user_id', viewerId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing?.emoji === emoji) return;

  if (existing) {
    const { error } = await client
      .from('conversation_message_reactions')
      .update({ emoji, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await client.from('conversation_message_reactions').insert({
    conversation_id: conversationId,
    message_id: messageId,
    user_id: viewerId,
    emoji,
  });
  if (error) throw error;
}

export function subscribeToConversationMessages(
  conversationId: string,
  onChange: () => void,
): RealtimeChannel {
  const client = requireSupabase();
  return client
    .channel(`conversation-messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversation_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange,
    )
    .subscribe();
}
