import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
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
  inviteGroupMember,
  leaveGroup,
  markConversationRead,
  renameGroup,
  setGroupMemberRole,
  sendTextMessage,
  sendMediaMessage,
  setConversationMessageReaction,
  startDirectConversation,
  startGroupConversation,
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

function ChatVideoAttachment({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => { instance.loop = false; });
  return <VideoView player={player} style={styles.attachmentVideo} nativeControls />;
}

function VoiceNotePlayer({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const format = (seconds: number) => {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
  };
  return (
    <View style={styles.voiceNote}>
      <TouchableOpacity onPress={() => status.playing ? player.pause() : player.play()} style={styles.voicePlay}>
        <Text style={styles.voicePlayText}>{status.playing ? 'Ⅱ' : '▶'}</Text>
      </TouchableOpacity>
      <View style={styles.voiceTrack}>
        <View style={styles.voiceTrackLine} />
        <Text style={styles.voiceDuration}>{format(status.currentTime)} / {format(status.duration)}</Text>
      </View>
    </View>
  );
}

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
  const [groupMode, setGroupMode] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<SearchProfile[]>([]);
  const [groupDetailsOpen, setGroupDetailsOpen] = useState(false);
  const [inviteSearchText, setInviteSearchText] = useState('');
  const [inviteResults, setInviteResults] = useState<SearchProfile[]>([]);
  const [groupRename, setGroupRename] = useState('');
  const [filter, setFilter] = useState<'All' | 'Requests'>('All');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 500);

  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis >= 120000) {
      void stopVoiceRecording();
    }
  }, [recorderState.isRecording, recorderState.durationMillis]);

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
    const channel = subscribeToConversationMessages(selectedId, changeType => {
      void loadMessages(selectedId);
      void loadConversations();
      if (changeType === 'message' && selectedConversation?.myMembership === 'accepted') {
        void markConversationRead(selectedId).catch(() => undefined);
      }
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
    setGroupMode(false);
    setSelectedGroupMembers([]);
    setGroupTitle('');
    setDraft('');
    setSearchText('');
    setSearchResults([]);
    setSearchOpen(true);
    setNotice('');
  }

  function openNewGroup() {
    setSelectedId(null); setNewRecipient(null); setDraft(''); setSearchText('');
    setSearchResults([]); setGroupMode(true); setGroupTitle('');
    setSelectedGroupMembers([]); setSearchOpen(true); setNotice('');
  }

  function toggleGroupMember(person: SearchProfile) {
    setSelectedGroupMembers(current => current.some(member => member.id === person.id)
      ? current.filter(member => member.id !== person.id)
      : current.length >= 49 ? current : [...current, person]);
  }

  async function createGroup() {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const conversationId = await startGroupConversation(selectedGroupMembers.map(member => member.id), groupTitle, draft);
      setSearchOpen(false); setGroupMode(false); setSelectedGroupMembers([]);
      setGroupTitle(''); setDraft('');
      await loadConversations(); setSelectedId(conversationId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create this group.');
    } finally { setBusy(false); }
  }

  async function searchGroupInvitees() {
    if (inviteSearchText.trim().length < 2 || searchBusy || !selectedConversation) return;
    setSearchBusy(true);
    setNotice('');
    try {
      const results = await searchProfiles(inviteSearchText);
      const existingIds = new Set(selectedConversation.members.map(member => member.user_id));
      setInviteResults(results.filter(person => person.id !== viewerId && !existingIds.has(person.id)));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Member search failed.');
    } finally {
      setSearchBusy(false);
    }
  }

  async function inviteMember(person: SearchProfile) {
    if (!selectedId || busy) return;
    setBusy(true);
    setNotice('');
    try {
      await inviteGroupMember(selectedId, person.id);
      setInviteResults(current => current.filter(item => item.id !== person.id));
      await loadConversations();
      setNotice(`Invitation sent to @${person.username}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not invite this member.');
    } finally {
      setBusy(false);
    }
  }

  async function changeGroupRole(member: ConversationPreview['members'][number]) {
    if (!selectedId || busy) return;
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    setBusy(true);
    setNotice('');
    try {
      await setGroupMemberRole(selectedId, member.user_id, nextRole);
      await loadConversations();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update this member role.');
    } finally {
      setBusy(false);
    }
  }

  async function saveGroupName() {
    if (!selectedId || busy) return;
    setBusy(true);
    setNotice('');
    try {
      await renameGroup(selectedId, groupRename);
      setGroupRename('');
      await loadConversations();
      setNotice('Group name updated.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not rename this group.');
    } finally {
      setBusy(false);
    }
  }

  function confirmLeaveGroup() {
    if (!selectedId || busy) return;
    Alert.alert('Leave this group?', 'You will stop receiving messages from this group.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave group', style: 'destructive', onPress: async () => {
        if (!selectedId) return;
        setBusy(true);
        setNotice('');
        try {
          await leaveGroup(selectedId);
          setSelectedId(null);
          setGroupDetailsOpen(false);
          await loadConversations();
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Could not leave this group.');
        } finally {
          setBusy(false);
        }
      } },
    ]);
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

  async function pickChatMedia() {
    if (!selectedId || selectedConversation?.myMembership !== 'accepted' || busy || recorderState.isRecording) return;
    setNotice('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow CREOVA to access your photos and videos to attach them to a message.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.85,
        videoMaxDuration: 120,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const attachmentType = asset.type === 'video' ? 'video' : 'image';
      const mimeType = asset.mimeType ?? (attachmentType === 'video' ? 'video/mp4' : 'image/jpeg');
      const extension = mimeType.split('/')[1]?.replace('quicktime', 'mov') ?? (attachmentType === 'video' ? 'mp4' : 'jpg');
      setBusy(true);
      await sendMediaMessage({
        conversationId: selectedId,
        uri: asset.uri,
        fileName: asset.fileName ?? `creova-${attachmentType}-${Date.now()}.${extension}`,
        mimeType,
        fileSize: asset.fileSize ?? null,
        attachmentType,
        durationMs: asset.duration ?? null,
      });
      await loadMessages(selectedId);
      await loadConversations();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not attach this media.');
    } finally {
      setBusy(false);
    }
  }

  async function startVoiceRecording() {
    if (!selectedId || selectedConversation?.myMembership !== 'accepted' || busy || recorderState.isRecording) return;
    setNotice('');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone access needed', 'Allow CREOVA to use your microphone to record a voice note.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setNotice('Recording voice note… tap Stop when you are finished.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not start voice recording.');
    }
  }

  async function stopVoiceRecording() {
    if (!recorderState.isRecording || busy) return;
    const durationMs = Math.min(120000, Math.round(recorderState.durationMillis));
    setBusy(true);
    setNotice('');
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = audioRecorder.uri;
      if (!uri || durationMs < 500) throw new Error('The voice note was too short. Record at least half a second.');
      if (!selectedId) throw new Error('Open a conversation before sending a voice note.');
      await sendMediaMessage({
        conversationId: selectedId,
        uri,
        fileName: `voice-note-${Date.now()}.m4a`,
        mimeType: 'audio/mp4',
        fileSize: recorderState.fileSize || null,
        attachmentType: 'audio',
        durationMs,
      });
      await loadMessages(selectedId);
      await loadConversations();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not send this voice note.');
    } finally {
      setBusy(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    }
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
    const isGroupAdmin = selectedConversation.kind === 'group' && selectedConversation.members.some(member => member.user_id === viewerId && member.role === 'admin' && member.membership_status === 'accepted');
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
          {selectedConversation.kind === 'group' ? (
            <TouchableOpacity onPress={() => setGroupDetailsOpen(value => !value)} style={styles.headerAction}>
              <Text style={styles.headerActionText}>ⓘ</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => { void loadMessages(selectedId); }} style={styles.headerAction}>
              <Text style={styles.headerActionText}>↻</Text>
            </TouchableOpacity>
          )}
        </View>
        {selectedConversation.kind === 'group' && groupDetailsOpen && (
          <View style={styles.groupDetails}>
            <View style={styles.groupDetailsHeading}>
              <View style={styles.headerCopy}>
                <Text style={styles.requestTitle}>{selectedConversation.title || 'CREOVA group'}</Text>
                <Text style={styles.subtitle}>{selectedConversation.members.length} participants</Text>
              </View>
              <TouchableOpacity onPress={() => setGroupDetailsOpen(false)} style={styles.headerAction}>
                <Text style={styles.headerActionText}>×</Text>
              </TouchableOpacity>
            </View>
            {selectedConversation.members.map(member => (
              <View key={member.user_id} style={styles.groupMemberRow}>
                <Avatar
                  uri={member.profile?.avatar_url ?? null}
                  label={member.profile?.display_name || member.profile?.username || 'Member'}
                  size={34}
                />
                <View style={styles.headerCopy}>
                  <Text style={styles.personName}>{member.profile?.display_name || 'CREOVA member'}{member.user_id === viewerId ? ' (You)' : ''}</Text>
                  <Text style={styles.subtitle}>{member.profile?.username ? `@${member.profile.username} · ` : ''}{member.role === 'admin' ? 'Group admin' : 'Member'} · {member.membership_status === 'accepted' ? 'Joined' : member.membership_status === 'pending' ? 'Invited' : member.membership_status}</Text>
                </View>
                {isGroupAdmin && member.user_id !== viewerId && member.membership_status === 'accepted' && (
                  <TouchableOpacity disabled={busy} onPress={() => { void changeGroupRole(member); }} style={styles.headerAction}>
                    <Text style={styles.selectText}>{member.role === 'admin' ? 'Remove admin' : 'Make admin'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {isGroupAdmin && (
              <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 }}>
                <Text style={styles.requestTitle}>Group administration</Text>
                <TextInput value={groupRename} onChangeText={setGroupRename} placeholder={selectedConversation.title || 'New group name'} placeholderTextColor="#71819C" style={styles.searchInput} maxLength={80} />
                <TouchableOpacity disabled={busy || !groupRename.trim()} onPress={() => { void saveGroupName(); }} style={[styles.primaryButton, (busy || !groupRename.trim()) && styles.disabledButton]}>
                  <Text style={styles.primaryButtonText}>{busy ? 'Saving…' : 'Rename group'}</Text>
                </TouchableOpacity>
                <Text style={styles.subtitle}>Invite another CREOVA member</Text>
                <View style={styles.searchRow}>
                  <TextInput value={inviteSearchText} onChangeText={setInviteSearchText} onSubmitEditing={() => { void searchGroupInvitees(); }} placeholder="Search username" placeholderTextColor="#71819C" autoCapitalize="none" style={styles.searchInput} />
                  <TouchableOpacity disabled={searchBusy} onPress={() => { void searchGroupInvitees(); }} style={styles.searchButton}>
                    <Text style={styles.searchButtonText}>{searchBusy ? '…' : 'Find'}</Text>
                  </TouchableOpacity>
                </View>
                {inviteResults.map(person => (
                  <View key={person.id} style={styles.groupMemberRow}>
                    <Avatar uri={person.avatar_url} label={person.display_name || person.username} size={32} />
                    <View style={styles.headerCopy}>
                      <Text style={styles.personName}>{person.display_name}</Text>
                      <Text style={styles.subtitle}>@{person.username}</Text>
                    </View>
                    <TouchableOpacity disabled={busy} onPress={() => { void inviteMember(person); }} style={styles.headerAction}>
                      <Text style={styles.selectText}>Invite</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity disabled={busy} onPress={confirmLeaveGroup} style={[styles.primaryButton, { backgroundColor: '#713044' }]}>
              <Text style={styles.primaryButtonText}>Leave group</Text>
            </TouchableOpacity>
          </View>
        )}
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
                  {message.attachment_url && !message.deleted_at && message.attachment_type === 'image' && (
                    <Image source={{ uri: message.attachment_url }} style={styles.attachmentImage} resizeMode="cover" />
                  )}
                  {message.attachment_url && !message.deleted_at && message.attachment_type === 'video' && (
                    <ChatVideoAttachment uri={message.attachment_url} />
                  )}
                  {message.attachment_url && !message.deleted_at && message.attachment_type === 'audio' && (
                    <VoiceNotePlayer uri={message.attachment_url} />
                  )}
                  {!!message.body && (
                    <Text style={[styles.messageText, own && styles.messageTextOwn]}>{message.deleted_at ? 'This message was deleted' : message.body}</Text>
                  )}
                  {!message.body && !message.attachment_url && (
                    <Text style={[styles.messageText, own && styles.messageTextOwn]}>{message.deleted_at ? 'This message was deleted' : 'Attachment unavailable'}</Text>
                  )}
                  <Text style={[styles.messageTime, own && styles.messageTimeOwn]}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {message.edited_at ? ' · edited' : ''}
                    {own && !message.deleted_at ? (otherMembers.length > 0 && otherMembers.every(member => member.last_read_at && new Date(member.last_read_at).getTime() >= new Date(message.created_at).getTime()) ? ' · Seen' : ' · Sent') : ''}
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
            {!editingMessageId && (
              <TouchableOpacity disabled={busy || recorderState.isRecording} onPress={pickChatMedia} style={styles.composerTool}>
                <Text style={styles.composerToolText}>＋</Text>
              </TouchableOpacity>
            )}
            {!editingMessageId && (
              <TouchableOpacity disabled={busy} onPress={() => recorderState.isRecording ? void stopVoiceRecording() : void startVoiceRecording()} style={[styles.composerTool, recorderState.isRecording && styles.recordingTool]}>
                <Text style={styles.composerToolText}>{recorderState.isRecording ? '■' : '🎙'}</Text>
              </TouchableOpacity>
            )}
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
              <Text style={styles.sendButtonText}>{busy ? '…' : editingMessageId ? 'Save' : recorderState.isRecording ? `${Math.floor(recorderState.durationMillis / 1000)}s` : 'Send'}</Text>
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
          <TouchableOpacity onPress={() => { setSearchOpen(false); setNewRecipient(null); setGroupMode(false); setSelectedGroupMembers([]); setNotice(''); }} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{groupMode ? 'Create a group' : newRecipient ? `Message ${newRecipient.display_name}` : 'New message'}</Text>
            <Text style={styles.subtitle}>{groupMode ? 'Select at least two members to start a group' : 'Find a CREOVA member to message'}</Text>
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
            {groupMode && selectedGroupMembers.length > 0 && (
              <View style={styles.selectedMembers}>
                {selectedGroupMembers.map(member => (
                  <TouchableOpacity key={member.id} onPress={() => toggleGroupMember(member)} style={styles.selectedMemberChip}>
                    <Text style={styles.selectedMemberText}>✓ {member.display_name || member.username} ×</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {searchResults.map(person => (
              <TouchableOpacity key={person.id} onPress={() => groupMode ? toggleGroupMember(person) : setNewRecipient(person)} style={styles.personRow}>
                <Avatar uri={person.avatar_url} label={person.display_name || person.username} />
                <View style={styles.headerCopy}>
                  <Text style={styles.personName}>{person.display_name}</Text>
                  <Text style={styles.subtitle}>@{person.username}{person.is_private ? ' · Private account' : ''}</Text>
                </View>
                <Text style={styles.selectText}>{groupMode ? selectedGroupMembers.some(member => member.id === person.id) ? 'Selected ✓' : 'Add +' : 'Select ›'}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {groupMode && (
          <View style={styles.firstMessageCard}>
            <Text style={styles.personName}>{selectedGroupMembers.length + 1} group members selected</Text>
            <TextInput value={groupTitle} onChangeText={setGroupTitle} placeholder="Group name (optional)" placeholderTextColor="#71819C" style={styles.searchInput} maxLength={80} />
            <TextInput value={draft} onChangeText={setDraft} placeholder="Write the group's first message…" placeholderTextColor="#71819C" style={[styles.composerInput, styles.firstMessageInput]} multiline maxLength={5000} />
            <TouchableOpacity disabled={busy || selectedGroupMembers.length < 2 || !draft.trim()} onPress={createGroup} style={[styles.primaryButton, (busy || selectedGroupMembers.length < 2 || !draft.trim()) && styles.disabledButton]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Creating…' : 'Create group'}</Text>
            </TouchableOpacity>
          </View>
        )}
        {newRecipient && !groupMode && (
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
        <View style={styles.newMessageActions}>
          <TouchableOpacity onPress={openNewMessage} style={styles.newMessageButton}><Text style={styles.newMessageText}>＋ New</Text></TouchableOpacity>
          <TouchableOpacity onPress={openNewGroup} style={styles.newMessageButton}><Text style={styles.newMessageText}>＋ Group</Text></TouchableOpacity>
        </View>
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
                  : item.latestMessage?.body || (item.latestMessage?.attachment_type === 'image' ? '📷 Photo' : item.latestMessage?.attachment_type === 'video' ? '▶ Video' : item.latestMessage?.attachment_type === 'audio' ? '🎙 Voice message' : 'Start the conversation')}
            </Text>
          </View>
          {item.myMembership === 'pending' && <View style={styles.requestDot} />}
          {item.myMembership === 'accepted' && item.latestMessage && item.latestMessage.sender_id !== viewerId && (() => {
            const ownMember = item.members.find(member => member.user_id === viewerId);
            const unread = !ownMember?.last_read_at || new Date(item.latestMessage.created_at).getTime() > new Date(ownMember.last_read_at).getTime();
            return unread ? <View style={styles.unreadDot} /> : null;
          })()}
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
  newMessageActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#3985FF', borderWidth: 1, borderColor: '#A7C6FF' },
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
  groupDetails: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 15, padding: 13, gap: 11 },
  groupDetailsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  groupMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
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
  attachmentImage: { width: 220, height: 190, borderRadius: 12, backgroundColor: COLORS.raised },
  attachmentVideo: { width: 230, height: 180, borderRadius: 12, backgroundColor: '#000000' },
  voiceNote: { minWidth: 190, maxWidth: 230, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  voicePlay: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  voicePlayText: { color: COLORS.blue, fontSize: 14, fontWeight: '900' },
  voiceTrack: { flex: 1, gap: 5 },
  voiceTrackLine: { height: 3, borderRadius: 2, backgroundColor: '#A7C6FF' },
  voiceDuration: { color: COLORS.muted, fontSize: 9 },
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
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  composerTool: { width: 36, height: 42, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  composerToolText: { color: '#A7C6FF', fontSize: 16, fontWeight: '900' },
  recordingTool: { backgroundColor: '#572334', borderColor: '#FF6688' },
  composerInput: { flex: 1, minHeight: 44, maxHeight: 130, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, color: COLORS.text, fontSize: 12, textAlignVertical: 'top' },
  sendButton: { backgroundColor: COLORS.blue, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13 },
  sendButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  selectedMembers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedMemberChip: { backgroundColor: COLORS.softBlue, borderWidth: 1, borderColor: '#355B9C', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6 },
  selectedMemberText: { color: '#C6DAFF', fontSize: 9, fontWeight: '800' },
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
