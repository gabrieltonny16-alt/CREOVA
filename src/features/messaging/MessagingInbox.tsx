import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { searchProfiles } from '../profile/profileService';
import type { CreovaProfile } from '../profile/profileService';
import {
  acceptConversationRequest,
  deleteConversationMessage,
  editConversationMessage,
  getConversationMessages,
  getMyConversations,
  markConversationRead,
  sendTextMessage,
  setConversationMessageReaction,
  startDirectConversation,
  subscribeToConversationMessages,
} from './messagingService';
import type { ConversationMessage, ConversationPreview } from './messagingService';

type SearchProfile = Pick<CreovaProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_private'>;

const COLORS = {
  background: '#090D18',
  surface: '#111A2B',
  raised: '#17243A',
  border: '#263650',
  text: '#F5F7FF',
  muted: '#9AAAC4',
  blue: '#3985FF',
  softBlue: '#172D55',
};

function Avatar({ uri, label, size = 44 }: { uri: string | null; label: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri
        ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[styles.avatarText, { fontSize: Math.max(13, size * 0.38) }]}>{label.slice(0, 1).toUpperCase()}</Text>}
    </View>
  );
}

export function MessagingInbox() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [viewerId, setViewerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [newRecipient, setNewRecipient] = useState<SearchProfile | null>(null);
  const [filter, setFilter] = useState<'All' | 'Requests'>('All');

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await getMyConversations());
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load your messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      setMessages(await getConversationMessages(conversationId));
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load this conversation.');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase?.auth.getUser().then(({ data }) => {
      if (active) setViewerId(data.user?.id ?? '');
    }).catch(() => undefined);
    void loadConversations();
    return () => { active = false; };
  }, [loadConversations]);

  const selectedConversation = useMemo(
    () => conversations.find(item => item.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
    if (selectedConversation?.myMembership === 'accepted') {
      void markConversationRead(selectedId).catch(() => undefined);
    }
    const channel = subscribeToConversationMessages(selectedId, () => {
      void loadMessages(selectedId);
      void loadConversations();
    });
    return () => {
      if (supabase) void supabase.removeChannel(channel);
    };
  }, [selectedId, selectedConversation?.myMembership, loadMessages, loadConversations]);

  async function runSearch() {
    if (searchText.trim().length < 2 || searchBusy) return;
    setSearchBusy(true);
    setNotice('');
    try {
      const results = await searchProfiles(searchText);
      setSearchResults(results.filter(item => item.id !== viewerId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Member search failed.');
    } finally {
      setSearchBusy(false);
    }
  }

  function openNewMessage() {
    setSelectedId(null);
    setNewRecipient(null);
    setDraft('');
    setSearchText('');
    setSearchResults([]);
    setSearchOpen(true);
    setNotice('');
  }

  async function sendMessage() {
    const cleanDraft = draft.trim();
    if (!cleanDraft || busy) return;
    setBusy(true);
    setNotice('');
    try {
      if (editingMessageId) {
        await editConversationMessage(editingMessageId, cleanDraft);
        setEditingMessageId(null);
        setDraft('');
        if (selectedId) await loadMessages(selectedId);
      } else if (newRecipient) {
        const conversationId = await startDirectConversation(newRecipient.id, cleanDraft);
        setNewRecipient(null);
        setSearchOpen(false);
        setDraft('');
        await loadConversations();
        setSelectedId(conversationId);
      } else if (selectedId) {
        await sendTextMessage(selectedId, cleanDraft);
        setDraft('');
        await loadMessages(selectedId);
        await loadConversations();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Your message could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReaction(message: ConversationMessage, emoji: '❤️' | '😂' | '😮' | '😢' | '👍' | '🔥') {
    if (!selectedId || selectedConversation?.myMembership !== 'accepted' || busy || message.deleted_at) return;
    setBusy(true);
    setNotice('');
    try {
      await setConversationMessageReaction(selectedId, message.id, emoji);
      await loadMessages(selectedId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add your reaction.');
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(message: ConversationMessage) {
    setEditingMessageId(message.id);
    setDraft(message.body ?? '');
    setNotice('');
  }

  function confirmDelete(message: ConversationMessage) {
    Alert.alert('Delete message?', 'This message will be removed from the conversation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!selectedId) return;
        setBusy(true);
        setNotice('');
        try {
          await deleteConversationMessage(message.id);
          await loadMessages(selectedId);
          await loadConversations();
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Could not delete this message.');
        } finally {
          setBusy(false);
        }
      } },
    ]);
  }

  async function acceptRequest() {
    if (!selectedId || busy) return;
    setBusy(true);
    setNotice('');
    try {
      await acceptConversationRequest(selectedId);
      await loadConversations();
      await loadMessages(selectedId);
      await markConversationRead(selectedId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not accept this message request.');
    } finally {
      setBusy(false);
    }
  }

  function conversationTitle(item: ConversationPreview) {
    if (item.kind === 'group') return item.title || 'CREOVA group';
    const other = item.members.find(member => member.user_id !== viewerId);
    return other?.profile?.display_name || (other?.profile?.username ? `@${other.profile.username}` : 'CREOVA member');
  }

  function conversationAvatar(item: ConversationPreview) {
    const other = item.members.find(member => member.user_id !== viewerId);
    return other?.profile?.avatar_url ?? null;
  }

  const visibleConversations = filter === 'Requests'
    ? conversations.filter(item => item.myMembership === 'pending')
    : conversations;

  if (selectedId && selectedConversation) {
    const otherMembers = selectedConversation.members.filter(member => member.user_id !== viewerId);
    return (
      <View style={styles.screen}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => { setSelectedId(null); setNewRecipient(null); void loadConversations(); }} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Avatar uri={conversationAvatar(selectedConversation)} label={conversationTitle(selectedConversation)} size={38} />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{conversationTitle(selectedConversation)}</Text>
            <Text style={styles.subtitle}>{selectedConversation.kind === 'group' ? `${selectedConversation.members.length} members` : otherMembers[0]?.profile?.username ? `@${otherMembers[0].profile.username}` : 'Direct message'}</Text>
          </View>
          <TouchableOpacity onPress={() => { void loadMessages(selectedId); }} style={styles.headerAction}>
            <Text style={styles.headerActionText}>↻</Text>
          </TouchableOpacity>
        </View>
        {selectedConversation.myMembership === 'pending' && (
          <View style={styles.requestNotice}>
            <Text style={styles.requestTitle}>Message request</Text>
            <Text style={styles.requestCopy}>Accept this request to reply and continue the conversation.</Text>
            <TouchableOpacity disabled={busy} onPress={acceptRequest} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : 'Accept request'}</Text>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListContent}>
          {messagesLoading && <Text style={styles.muted}>Loading messages…</Text>}
          {!messagesLoading && messages.length === 0 && <Text style={styles.muted}>No messages yet. Start the conversation.</Text>}
          {messages.map(message => {
            const own = message.sender_id === viewerId;
            return (
              <View key={message.id} style={[styles.messageRow, own && styles.messageRowOwn]}>
                <View style={[styles.messageBubble, own ? styles.messageBubbleOwn : styles.messageBubbleOther]}>
                  <Text style={[styles.messageText, own && styles.messageTextOwn]}>
                    {message.deleted_at ? 'This message was deleted' : message.body || 'Attachment'}
                  </Text>
                  <Text style={[styles.messageTime, own && styles.messageTimeOwn]}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {message.edited_at ? ' · edited' : ''}
                  </Text>
                </View>
                <View style={[styles.messageExtras, own && styles.messageExtrasOwn]}>
                  {!!message.reactions?.length && (
                    <View style={styles.reactionSummary}>
                      {[...new Set(message.reactions.map(reaction => reaction.emoji))].map(emoji => {
                        const count = message.reactions.filter(reaction => reaction.emoji === emoji).length;
                        const mine = message.reactions.some(reaction => reaction.emoji === emoji && reaction.user_id === viewerId);
                        return <Text key={emoji} style={[styles.reactionCount, mine && styles.reactionCountMine]}>{emoji} {count}</Text>;
                      })}
                    </View>
                  )}
                  {selectedConversation.myMembership === 'accepted' && !message.deleted_at && (
                    <View style={styles.messageTools}>
                      {(['❤️', '😂', '😮', '😢', '👍', '🔥'] as const).map(emoji => (
                        <TouchableOpacity key={emoji} disabled={busy} onPress={() => { void handleReaction(message, emoji); }} style={styles.reactionButton}>
                          <Text style={styles.reactionButtonText}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                      {own && <TouchableOpacity disabled={busy} onPress={() => beginEdit(message)} style={styles.messageAction}><Text style={styles.messageActionText}>Edit</Text></TouchableOpacity>}
                      {own && <TouchableOpacity disabled={busy} onPress={() => confirmDelete(message)} style={styles.messageAction}><Text style={styles.messageActionDanger}>Delete</Text></TouchableOpacity>}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
        {selectedConversation.myMembership === 'accepted' && (
          <View style={styles.composer}>
            {editingMessageId && <TouchableOpacity onPress={() => { setEditingMessageId(null); setDraft(''); }} style={styles.cancelEdit}><Text style={styles.cancelEditText}>Cancel edit</Text></TouchableOpacity>}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={editingMessageId ? 'Edit your message…' : 'Write a message…'}
              placeholderTextColor="#71819C"
              style={styles.composerInput}
              multiline
              maxLength={5000}
              editable={!busy}
            />
            <TouchableOpacity disabled={busy || !draft.trim()} onPress={sendMessage} style={[styles.sendButton, (busy || !draft.trim()) && styles.disabledButton]}>
              <Text style={styles.sendButtonText}>{busy ? '…' : editingMessageId ? 'Save' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        )}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
      </View>
    );
  }

  if (searchOpen) {
    return (
      <View style={styles.screen}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => { setSearchOpen(false); setNewRecipient(null); setNotice(''); }} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{newRecipient ? `Message ${newRecipient.display_name}` : 'New message'}</Text>
            <Text style={styles.subtitle}>Find a CREOVA member to message</Text>
          </View>
        </View>
        {!newRecipient && (
          <>
            <View style={styles.searchRow}>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={runSearch}
                placeholder="Search username"
                placeholderTextColor="#71819C"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              <TouchableOpacity onPress={runSearch} disabled={searchBusy} style={styles.searchButton}>
                <Text style={styles.searchButtonText}>{searchBusy ? '…' : 'Search'}</Text>
              </TouchableOpacity>
            </View>
            {searchResults.map(person => (
              <TouchableOpacity key={person.id} onPress={() => setNewRecipient(person)} style={styles.personRow}>
                <Avatar uri={person.avatar_url} label={person.display_name || person.username} />
                <View style={styles.headerCopy}>
                  <Text style={styles.personName}>{person.display_name}</Text>
                  <Text style={styles.subtitle}>@{person.username}{person.is_private ? ' · Private account' : ''}</Text>
                </View>
                <Text style={styles.selectText}>Select ›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {newRecipient && (
          <View style={styles.firstMessageCard}>
            <Avatar uri={newRecipient.avatar_url} label={newRecipient.display_name || newRecipient.username} size={54} />
            <Text style={styles.personName}>{newRecipient.display_name}</Text>
            <Text style={styles.subtitle}>@{newRecipient.username}</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write your first message…"
              placeholderTextColor="#71819C"
              style={[styles.composerInput, styles.firstMessageInput]}
              multiline
              maxLength={5000}
            />
            <TouchableOpacity disabled={busy || !draft.trim()} onPress={sendMessage} style={[styles.primaryButton, (busy || !draft.trim()) && styles.disabledButton]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Sending…' : 'Send message'}</Text>
            </TouchableOpacity>
          </View>
        )}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PRIVATE CONVERSATIONS</Text>
          <Text style={styles.title}>Messages</Text>
        </View>
        <TouchableOpacity onPress={openNewMessage} style={styles.newMessageButton}>
          <Text style={styles.newMessageText}>＋ New</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.filterRow}>
        {(['All', 'Requests'] as const).map(value => (
          <TouchableOpacity key={value} onPress={() => setFilter(value)} style={[styles.filterChip, filter === value && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => { setLoading(true); void loadConversations(); }} style={styles.refreshButton}>
          <Text style={styles.refreshText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      {loading && <Text style={styles.muted}>Loading conversations…</Text>}
      {!loading && visibleConversations.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{filter === 'Requests' ? 'No message requests' : 'Your messages start here'}</Text>
          <Text style={styles.muted}>Start a private conversation with someone on CREOVA.</Text>
          <TouchableOpacity onPress={openNewMessage} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start a conversation</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && visibleConversations.map(item => (
        <TouchableOpacity key={item.id} onPress={() => setSelectedId(item.id)} style={styles.conversationRow}>
          <Avatar uri={conversationAvatar(item)} label={conversationTitle(item)} />
          <View style={styles.conversationCopy}>
            <View style={styles.conversationTopLine}>
              <Text style={styles.personName} numberOfLines={1}>{conversationTitle(item)}</Text>
              <Text style={styles.messageTime}>{item.latestMessage ? new Date(item.latestMessage.created_at).toLocaleDateString() : ''}</Text>
            </View>
            <Text style={styles.previewText} numberOfLines={1}>
              {item.myMembership === 'pending'
                ? 'Message request · Tap to review'
                : item.latestMessage?.deleted_at
                  ? 'Message deleted'
                  : item.latestMessage?.body || 'Start the conversation'}
            </Text>
          </View>
          {item.myMembership === 'pending' && <View style={styles.requestDot} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 14, minHeight: 420 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { color: '#83AFFF', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: COLORS.text, fontSize: 25, fontWeight: '900' },
  subtitle: { color: COLORS.muted, fontSize: 10 },
  avatar: { backgroundColor: COLORS.softBlue, borderWidth: 1, borderColor: '#355B9C', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { color: '#A7C6FF', fontWeight: '900' },
  newMessageButton: { backgroundColor: COLORS.softBlue, borderWidth: 1, borderColor: '#355B9C', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11 },
  newMessageText: { color: '#A7C6FF', fontSize: 11, fontWeight: '900' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18 },
  filterChipActive: { backgroundColor: COLORS.softBlue, borderColor: COLORS.blue },
  filterText: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  filterTextActive: { color: '#C6DAFF' },
  refreshButton: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 8 },
  refreshText: { color: '#A7C6FF', fontSize: 10, fontWeight: '800' },
  conversationRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  conversationCopy: { flex: 1, gap: 5 },
  conversationTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  personName: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  previewText: { color: COLORS.muted, fontSize: 10 },
  messageTime: { color: COLORS.muted, fontSize: 9 },
  requestDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.blue },
  emptyCard: { alignItems: 'center', gap: 12, padding: 22, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  emptyTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  muted: { color: COLORS.muted, fontSize: 11, lineHeight: 18 },
  primaryButton: { backgroundColor: COLORS.blue, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#A7C6FF', fontSize: 30, lineHeight: 34 },
  headerAction: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  headerActionText: { color: '#A7C6FF', fontSize: 20 },
  requestNotice: { backgroundColor: COLORS.surface, borderColor: '#355B9C', borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  requestTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  requestCopy: { color: COLORS.muted, fontSize: 10, lineHeight: 16 },
  messageList: { maxHeight: 470, minHeight: 240 },
  messageListContent: { gap: 9, paddingVertical: 10 },
  messageRow: { flexDirection: 'column', alignItems: 'flex-start' },
  messageRowOwn: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '84%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, gap: 5 },
  messageBubbleOwn: { backgroundColor: COLORS.blue, borderBottomRightRadius: 5 },
  messageBubbleOther: { backgroundColor: COLORS.raised, borderBottomLeftRadius: 5 },
  messageText: { color: COLORS.text, fontSize: 12, lineHeight: 18 },
  messageTextOwn: { color: '#FFFFFF' },
  messageTimeOwn: { color: '#D9E7FF' },
  messageExtras: { maxWidth: '84%', gap: 5, marginTop: 3, alignSelf: 'flex-start' },
  messageExtrasOwn: { alignSelf: 'flex-end' },
  reactionSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  reactionCount: { color: '#D7E4FA', backgroundColor: COLORS.raised, borderRadius: 10, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, fontSize: 10 },
  reactionCountMine: { borderWidth: 1, borderColor: COLORS.blue },
  messageTools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  reactionButton: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 4 },
  reactionButtonText: { fontSize: 12 },
  messageAction: { paddingHorizontal: 7, paddingVertical: 5 },
  messageActionText: { color: '#A7C6FF', fontSize: 9, fontWeight: '800' },
  messageActionDanger: { color: '#FF9BAA', fontSize: 9, fontWeight: '800' },
  cancelEdit: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5 },
  cancelEditText: { color: '#A7C6FF', fontSize: 10, fontWeight: '800' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  composerInput: { flex: 1, minHeight: 44, maxHeight: 130, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, color: COLORS.text, fontSize: 12, textAlignVertical: 'top' },
  sendButton: { backgroundColor: COLORS.blue, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13 },
  sendButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 12, color: COLORS.text, fontSize: 12 },
  searchButton: { backgroundColor: COLORS.blue, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  selectText: { color: '#A7C6FF', fontSize: 10, fontWeight: '900' },
  firstMessageCard: { alignItems: 'center', gap: 10, padding: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 17 },
  firstMessageInput: { width: '100%', minHeight: 110 },
  notice: { color: '#FFB5C3', fontSize: 10, lineHeight: 16 },
});
