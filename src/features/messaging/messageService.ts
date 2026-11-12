import { requireSupabase } from '../../lib/supabase';

export type MessageParticipant = {
  user_id: string;
  role: 'admin' | 'member';
  membership_status: 'accepted' | 'pending' | 'declined' | 'left';
  last_read_at?: string | null;
  profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type MessageAttachmentInput = {
  uri: string;
  kind: 'image' | 'video' | 'audio';
  fileName: string;
  mimeType: string;
  fileSize: number;
  durationMs?: number | null;
};

export type MessageReactionEmoji = '❤️' | '😂' | '😮' | '😢' | '👍' | '🔥';

export type MessageReactionSummary = {
  emoji: MessageReactionEmoji;
  count: number;
  reactedByMe: boolean;
};

export type CreovaMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_message_id: string;
  body: string | null;
  created_at: string;
  attachment_type: 'image' | 'video' | 'audio' | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_size: number | null;
  attachment_duration_ms: number | null;
  attachmentUrl?: string | null;
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
      .select('conversation_id, user_id, role, membership_status, last_read_at, profile:profiles!conversation_members_user_id_fkey(username, display_name, avatar_url)')
      .in('conversation_id', ids),
    client.from('conversation_messages')
      .select('id, conversation_id, sender_id, client_message_id, body, created_at, attachment_type, attachment_path, attachment_name, attachment_mime_type, attachment_size, attachment_duration_ms, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)')
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


const MESSAGE_REACTION_EMOJIS: MessageReactionEmoji[] = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

async function getMessageReactionSummaries(
  conversationId: string,
  messageIds: string[],
): Promise<Record<string, MessageReactionSummary[]>> {
  const summaries: Record<string, MessageReactionSummary[]> = {};
  if (!messageIds.length) return summaries;
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view message reactions.');
  const { data, error } = await client
    .from('conversation_message_reactions')
    .select('message_id, user_id, emoji')
    .eq('conversation_id', conversationId)
    .in('message_id', messageIds);
  if (error) throw error;
  const grouped = new Map<string, Map<MessageReactionEmoji, { count: number; reactedByMe: boolean }>>();
  for (const row of data ?? []) {
    const emoji = row.emoji as MessageReactionEmoji;
    if (!MESSAGE_REACTION_EMOJIS.includes(emoji)) continue;
    if (!grouped.has(row.message_id)) grouped.set(row.message_id, new Map());
    const byEmoji = grouped.get(row.message_id)!;
    const current = byEmoji.get(emoji) ?? { count: 0, reactedByMe: false };
    current.count += 1;
    current.reactedByMe ||= row.user_id === auth.user.id;
    byEmoji.set(emoji, current);
  }
  for (const [messageId, byEmoji] of grouped) {
    summaries[messageId] = Array.from(byEmoji.entries()).map(([emoji, value]) => ({
      emoji, count: value.count, reactedByMe: value.reactedByMe,
    }));
  }
  return summaries;
}

export async function setMessageReaction(
  conversationId: string,
  messageId: string,
  emoji: MessageReactionEmoji | null,
): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to react to messages.');
  if (emoji !== null && !MESSAGE_REACTION_EMOJIS.includes(emoji)) {
    throw new Error('Choose a supported reaction.');
  }
  if (emoji === null) {
    const { error } = await client
      .from('conversation_message_reactions')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('message_id', messageId)
      .eq('user_id', auth.user.id);
    if (error) throw error;
    return;
  }
  const { error } = await client
    .from('conversation_message_reactions')
    .upsert({
      conversation_id: conversationId,
      message_id: messageId,
      user_id: auth.user.id,
      emoji,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'message_id,user_id' });
  if (error) throw error;
}

export async function getConversationMessages(conversationId: string): Promise<CreovaMessage[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('conversation_messages')
    .select('id, conversation_id, sender_id, client_message_id, body, created_at, attachment_type, attachment_path, attachment_name, attachment_mime_type, attachment_size, attachment_duration_ms, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const paths = rows.flatMap(row => row.attachment_path ? [row.attachment_path] : []);
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed, error: signedError } = await client.storage.from('creova-chat-media').createSignedUrls(paths, 3600);
    if (signedError) throw signedError;
    (signed ?? []).forEach(item => {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    });
  }
  const reactionsByMessage = await getMessageReactionSummaries(conversationId, rows.map(row => row.id));
  return rows.map(row => ({
    ...row,
    attachmentUrl: row.attachment_path ? signedByPath.get(row.attachment_path) ?? null : null,
    reactions: reactionsByMessage[row.id] ?? [],
    sender: Array.isArray(row.sender) ? row.sender[0] : row.sender,
  })) as CreovaMessage[];
}


export async function searchConversationMessages(conversationId: string, query: string): Promise<CreovaMessage[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const escaped = term.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await requireSupabase()
    .from('conversation_messages')
    .select('id, conversation_id, sender_id, client_message_id, body, created_at, attachment_type, attachment_path, attachment_name, attachment_mime_type, attachment_size, attachment_duration_ms, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .not('body', 'is', null)
    .ilike('body', `%${escaped}%`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    attachmentUrl: null,
    sender: Array.isArray(row.sender) ? row.sender[0] : row.sender,
  })) as CreovaMessage[];
}

export async function getConversationMessagesAround(
  conversationId: string,
  messageId: string,
): Promise<CreovaMessage[]> {
  const client = requireSupabase();
  const columns = 'id, conversation_id, sender_id, client_message_id, body, created_at, attachment_type, attachment_path, attachment_name, attachment_mime_type, attachment_size, attachment_duration_ms, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)';
  const { data: target, error: targetError } = await client
    .from('conversation_messages')
    .select(columns)
    .eq('conversation_id', conversationId)
    .eq('id', messageId)
    .single();
  if (targetError) throw targetError;

  const { data: before, error: beforeError } = await client
    .from('conversation_messages')
    .select(columns)
    .eq('conversation_id', conversationId)
    .lt('created_at', target.created_at)
    .order('created_at', { ascending: false })
    .limit(20);
  if (beforeError) throw beforeError;

  const rows = [...(before ?? []).reverse(), target] as any[];
  const paths = rows.flatMap(row => row.attachment_path ? [row.attachment_path] : []);
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed, error: signedError } = await client.storage
      .from('creova-chat-media')
      .createSignedUrls(paths, 3600);
    if (signedError) throw signedError;
    (signed ?? []).forEach(item => {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    });
  }
  const reactionsByMessage = await getMessageReactionSummaries(conversationId, rows.map(row => row.id));
  return rows.map(row => ({
    ...row,
    attachmentUrl: row.attachment_path ? signedByPath.get(row.attachment_path) ?? null : null,
    reactions: reactionsByMessage[row.id] ?? [],
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

export async function sendMessage(
  conversationId: string,
  body: string,
  clientMessageId = makeUuid(),
  attachment?: MessageAttachmentInput,
): Promise<CreovaMessage> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to send a message.');
  const trimmed = body.trim();
  if (!trimmed && !attachment) throw new Error('Write a message or attach media first.');
  if (trimmed.length > 5000) throw new Error('Messages must be 5,000 characters or fewer.');
  if (attachment && (attachment.fileSize < 1 || attachment.fileSize > 25 * 1024 * 1024)) {
    throw new Error('Chat attachments must be 25 MB or smaller.');
  }
  if (attachment?.durationMs && attachment.durationMs > 120000) {
    throw new Error('Voice notes and videos must be 2 minutes or shorter.');
  }

  let attachmentPath: string | null = null;
  let uploadedSize: number | null = null;
  if (attachment) {
    const safeName = attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'attachment';
    const extension = safeName.includes('.') ? safeName.split('.').pop() : 'bin';
    attachmentPath = `${conversationId}/${auth.user.id}/${clientMessageId}.${extension}`;
    const response = await fetch(attachment.uri);
    if (!response.ok) throw new Error('Could not read the selected attachment from your device.');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('Chat attachments must be 25 MB or smaller.');
    uploadedSize = bytes.byteLength;
    const { error: uploadError } = await client.storage.from('creova-chat-media').upload(attachmentPath, bytes, {
      contentType: attachment.mimeType,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) {
      // A retry may find the same deterministic object from an earlier uncertain send.
      const { data: existingObject, error: lookupError } = await client.storage
        .from('creova-chat-media').createSignedUrl(attachmentPath, 60);
      if (lookupError || !existingObject?.signedUrl) throw uploadError;
    }
  }

  const payload = {
    conversation_id: conversationId,
    sender_id: auth.user.id,
    client_message_id: clientMessageId,
    body: trimmed || null,
    attachment_type: attachment?.kind ?? null,
    attachment_path: attachmentPath,
    attachment_name: attachment?.fileName ?? null,
    attachment_mime_type: attachment?.mimeType ?? null,
    attachment_size: uploadedSize,
    attachment_duration_ms: attachment?.durationMs ?? null,
  };
  const { data, error } = await client.from('conversation_messages').insert(payload)
    .select('id, conversation_id, sender_id, client_message_id, body, created_at, attachment_type, attachment_path, attachment_name, attachment_mime_type, attachment_size, attachment_duration_ms, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)').single();
  if (error) {
    if (error.code === '23505') {
      const { data: existing, error: existingError } = await client.from('conversation_messages')
        .select('id, conversation_id, sender_id, client_message_id, body, created_at, attachment_type, attachment_path, attachment_name, attachment_mime_type, attachment_size, attachment_duration_ms, sender:profiles!conversation_messages_sender_id_fkey(username, display_name, avatar_url)')
        .eq('sender_id', auth.user.id)
        .eq('client_message_id', clientMessageId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const signed = existing.attachment_path
          ? await client.storage.from('creova-chat-media').createSignedUrl(existing.attachment_path, 3600)
          : null;
        if (signed?.error) throw signed.error;
        return {
          ...existing,
          attachmentUrl: signed?.data?.signedUrl ?? null,
          sender: Array.isArray(existing.sender) ? existing.sender[0] : existing.sender,
        } as CreovaMessage;
      }
    }
    if (attachmentPath) await client.storage.from('creova-chat-media').remove([attachmentPath]);
    throw error;
  }
  const signed = data.attachment_path
    ? await client.storage.from('creova-chat-media').createSignedUrl(data.attachment_path, 3600)
    : null;
  if (signed?.error) throw signed.error;
  return {
    ...data,
    attachmentUrl: signed?.data?.signedUrl ?? null,
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
  onReactionChange?: () => void,
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
        attachment_type: row.attachment_type ?? null,
        attachment_path: row.attachment_path ?? null,
        attachment_name: row.attachment_name ?? null,
        attachment_mime_type: row.attachment_mime_type ?? null,
        attachment_size: row.attachment_size ?? null,
        attachment_duration_ms: row.attachment_duration_ms ?? null,
        attachmentUrl: null,
        sender: null,
      });
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversation_message_reactions',
      filter: `conversation_id=eq.${conversationId}`,
    }, () => onReactionChange?.())
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
