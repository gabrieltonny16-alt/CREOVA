import React, { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  createStory,
  deleteStory,
  getActiveStoryGroups,
  getStoryViewers,
  getStoryEngagement,
  sendStoryReply,
  toggleStoryReaction,
  recordStoryView,
} from './storyService';
import type { CreovaStory, CreovaStoryGroup, CreovaStoryViewer, StoryEngagement } from './storyService';

const BLUE = '#3985FF';
const MUTED = '#9AAAC4';
const STORY_BACKGROUND = '#070B14';

function StoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = false;
    instance.play();
  });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />;
}

function StoryViewerModal({
  groups,
  initialGroupIndex,
  onClose,
  onViewed,
}: {
  groups: CreovaStoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
  onViewed: () => void;
}) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState<CreovaStoryViewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [engagement, setEngagement] = useState<StoryEngagement>({ reactions: [], replies: [] });
  const [showEngagement, setShowEngagement] = useState(false);
  const [engagementBusy, setEngagementBusy] = useState(false);
  const group = groups[groupIndex];
  const story: CreovaStory | undefined = group?.stories[storyIndex];

  function advance(direction: 1 | -1) {
    if (!group) return;
    const nextStory = storyIndex + direction;
    if (nextStory >= 0 && nextStory < group.stories.length) {
      setStoryIndex(nextStory);
      return;
    }
    const nextGroup = groupIndex + direction;
    if (nextGroup >= 0 && nextGroup < groups.length) {
      setGroupIndex(nextGroup);
      setStoryIndex(direction > 0 ? 0 : groups[nextGroup].stories.length - 1);
      return;
    }
    onClose();
  }

  useEffect(() => {
    if (!story) return;
    setProgress(0);
    setShowViewers(false);
    setShowEngagement(false);
    setEngagement({ reactions: [], replies: [] });
    setReply('');
    setViewers([]);
    if (!group.isMine) {
      void recordStoryView(story.id).then(onViewed).catch(error => {
        setMessage(error instanceof Error ? error.message : 'Could not record this view.');
      });
    }
    const duration = story.mediaType === 'video'
      ? Math.max(5000, Math.min(30000, (story.durationSeconds ?? 15) * 1000))
      : 5000;
    const started = Date.now();
    const tick = setInterval(() => setProgress(Math.min(100, ((Date.now() - started) / duration) * 100)), 100);
    const timeout = setTimeout(() => advance(1), duration);
    return () => {
      clearInterval(tick);
      clearTimeout(timeout);
    };
  }, [groupIndex, storyIndex]);

  async function openViewers() {
    if (!story || !group?.isMine) return;
    setMessage('');
    try {
      setViewers(await getStoryViewers(story.id));
      setShowViewers(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load story viewers.');
    }
  }


  async function reactToStory(reaction: '❤️' | '😂' | '😮' | '😢' | '🔥' | '👏') {
    if (!story || group?.isMine || engagementBusy) return;
    setEngagementBusy(true);
    setMessage('');
    try {
      await toggleStoryReaction(story.id, reaction);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send your reaction.');
    } finally {
      setEngagementBusy(false);
    }
  }

  async function submitReply() {
    if (!story || group?.isMine || sendingReply) return;
    setSendingReply(true);
    setMessage('');
    try {
      await sendStoryReply(story.id, reply);
      setReply('');
      setMessage('Reply sent.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send your reply.');
    } finally {
      setSendingReply(false);
    }
  }

  async function openEngagement() {
    if (!story || !group?.isMine) return;
    setMessage('');
    try {
      setEngagement(await getStoryEngagement(story.id));
      setShowEngagement(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load story engagement.');
    }
  }

  async function removeCurrentStory() {
    if (!story || !group?.isMine) return;
    try {
      await deleteStory(story.id);
      onViewed();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete this story.');
    }
  }

  if (!story || !group) return null;
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: STORY_BACKGROUND, justifyContent: 'center' }}>
        {story.mediaType === 'video'
          ? <StoryVideo key={story.id} uri={story.signedUrl} />
          : <Image source={{ uri: story.signedUrl }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <View style={{ paddingTop: 48, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 14 }}>
              {group.stories.map((item, index) => (
                <View key={item.id} style={{ height: 3, flex: 1, backgroundColor: 'rgba(255,255,255,0.32)', borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ height: 3, width: index < storyIndex ? '100%' : index === storyIndex ? `${progress}%` : '0%', backgroundColor: '#FFFFFF' }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#1D2C48', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {group.author?.avatar_url
                  ? <Image source={{ uri: group.author.avatar_url }} style={{ width: 38, height: 38 }} />
                  : <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{(group.author?.display_name || group.author?.username || 'C').slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13 }}>{group.isMine ? 'Your story' : group.author?.display_name || 'CREOVA member'}</Text>
                <Text style={{ color: '#D0D8E8', fontSize: 10 }}>{new Date(story.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              {group.isMine && <TouchableOpacity onPress={openViewers} style={{ padding: 8 }}><Text style={{ color: '#FFFFFF', fontSize: 12 }}>◉ {story.viewCount}</Text></TouchableOpacity>}
              {group.isMine && <TouchableOpacity onPress={openEngagement} style={{ padding: 8 }}><Text style={{ color: '#FFFFFF', fontSize: 12 }}>Replies</Text></TouchableOpacity>}
              {group.isMine && <TouchableOpacity onPress={removeCurrentStory} style={{ padding: 8 }}><Text style={{ color: '#FFFFFF', fontSize: 12 }}>Delete</Text></TouchableOpacity>}
              <TouchableOpacity onPress={onClose} style={{ padding: 8 }}><Text style={{ color: '#FFFFFF', fontSize: 24 }}>×</Text></TouchableOpacity>
            </View>
          </View>
          {!!story.caption && <View style={{ position: 'absolute', left: 22, right: 22, bottom: 70, alignItems: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center', textShadowColor: '#000000', textShadowRadius: 8 }}>{story.caption}</Text></View>}
          <View style={{ position: 'absolute', top: 115, bottom: 65, left: 0, right: 0, flexDirection: 'row' }}>
            <TouchableOpacity onPress={() => advance(-1)} style={{ width: '35%' }} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => advance(1)} style={{ width: '35%' }} />
          </View>
          {showViewers && <View style={{ position: 'absolute', left: 12, right: 12, bottom: 28, maxHeight: '48%', backgroundColor: '#111A2B', borderRadius: 16, padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Story viewers · {viewers.length}</Text>
              <TouchableOpacity onPress={() => setShowViewers(false)}><Text style={{ color: BLUE, fontWeight: '800' }}>Close</Text></TouchableOpacity>
            </View>
            <ScrollView>
              {viewers.map(viewer => <View key={viewer.viewer_id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#263650' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{viewer.viewer?.display_name || 'CREOVA member'}</Text>
                <Text style={{ color: MUTED, fontSize: 11 }}>@{viewer.viewer?.username || 'member'}</Text>
              </View>)}
              {!viewers.length && <Text style={{ color: MUTED, paddingVertical: 8 }}>No views yet.</Text>}
            </ScrollView>
          </View>}

          {!group.isMine && <View style={{ position: 'absolute', left: 12, right: 12, bottom: 20, backgroundColor: 'rgba(10,16,29,0.94)', borderRadius: 16, padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              {(['❤️', '😂', '😮', '😢', '🔥', '👏'] as const).map(reaction => (
                <TouchableOpacity key={reaction} disabled={engagementBusy} onPress={() => void reactToStory(reaction)} style={{ paddingHorizontal: 5, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 23 }}>{reaction}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput value={reply} onChangeText={setReply} placeholder="Reply to story…" placeholderTextColor={MUTED} maxLength={1000} multiline style={{ flex: 1, color: '#FFFFFF', backgroundColor: '#1A2740', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, maxHeight: 76, fontSize: 13 }} />
              <TouchableOpacity disabled={sendingReply || !reply.trim()} onPress={() => void submitReply()} style={{ backgroundColor: BLUE, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10, opacity: sendingReply || !reply.trim() ? 0.5 : 1 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12 }}>{sendingReply ? '…' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>}
          {showEngagement && <View style={{ position: 'absolute', left: 12, right: 12, bottom: 24, maxHeight: '58%', backgroundColor: '#111A2B', borderRadius: 16, padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Story engagement · {engagement.reactions.length} reactions · {engagement.replies.length} replies</Text>
              <TouchableOpacity onPress={() => setShowEngagement(false)}><Text style={{ color: BLUE, fontWeight: '800' }}>Close</Text></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', marginBottom: 6 }}>Reactions</Text>
              <Text style={{ color: MUTED, marginBottom: 12 }}>{(['❤️', '😂', '😮', '😢', '🔥', '👏'] as const).map(emoji => {
                const count = engagement.reactions.filter(item => item.reaction === emoji).length;
                return count ? `${emoji} ${count}` : '';
              }).filter(Boolean).join('   ') || 'No reactions yet.'}</Text>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', marginBottom: 6 }}>Replies</Text>
              {engagement.replies.map(item => <View key={item.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#263650' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{item.sender?.display_name || 'CREOVA member'} <Text style={{ color: MUTED, fontWeight: '400' }}>@{item.sender?.username || 'member'}</Text></Text>
                <Text style={{ color: '#E5ECF8', marginTop: 3 }}>{item.body}</Text>
                <Text style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>)}
              {!engagement.replies.length && <Text style={{ color: MUTED }}>No replies yet.</Text>}
            </ScrollView>
          </View>}

          {!!message && <Text style={{ position: 'absolute', bottom: group.isMine ? 18 : 112, left: 16, right: 16, color: '#FFFFFF', textAlign: 'center' }}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
}

export function StoriesSection() {
  const [groups, setGroups] = useState<CreovaStoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<'followers' | 'public'>('followers');
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);
  const [composerAsset, setComposerAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');

  async function loadStories() {
    try {
      setGroups(await getActiveStoryGroups());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load stories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadStories(); }, []);

  async function addStory() {
    if (busy || composerAsset) return;
    setMessage('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Allow photo-library access to add a story.');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      setCaption('');
      setComposerAsset(result.assets[0]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not select story media.');
    }
  }

  async function publishStory() {
    if (!composerAsset || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const asset = composerAsset;
      const mediaType = asset.type === 'video' || asset.mimeType?.startsWith('video/') ? 'video' : 'image';
      const mimeType = asset.mimeType ?? (mediaType === 'image' ? 'image/jpeg' : '');
      const allowed = mediaType === 'image'
        ? ['image/jpeg', 'image/png', 'image/webp']
        : ['video/mp4', 'video/quicktime', 'video/webm'];
      if (!allowed.includes(mimeType)) throw new Error('Choose a JPEG, PNG, WebP, MP4, MOV, or WebM file.');
      const maximum = mediaType === 'image' ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > maximum) throw new Error(mediaType === 'image' ? 'Images must be 10 MB or smaller.' : 'Videos must be 25 MB or smaller.');
      const durationSeconds = mediaType === 'video' ? (asset.duration ?? 0) / 1000 : null;
      if (mediaType === 'video' && (!durationSeconds || durationSeconds > 30)) throw new Error('Story videos must be 30 seconds or shorter.');
      await createStory({
        uri: asset.uri,
        mimeType,
        fileSize: asset.fileSize ?? null,
        durationSeconds,
        visibility,
        caption: caption.trim(),
      });
      setComposerAsset(null);
      setCaption('');
      await loadStories();
      setMessage('Story shared.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create your story.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>Stories</Text>
        <TouchableOpacity onPress={() => setVisibility(current => current === 'followers' ? 'public' : 'followers')} style={{ borderWidth: 1, borderColor: '#263650', backgroundColor: '#111A2B', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: BLUE, fontSize: 10, fontWeight: '800' }}>Audience: {visibility === 'followers' ? 'Followers' : 'Public'} · Change</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 15, paddingVertical: 4 }}>
        <TouchableOpacity disabled={busy} onPress={addStory} style={{ alignItems: 'center', width: 66 }}>
          <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: BLUE, backgroundColor: '#14223A', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 29, lineHeight: 32 }}>{busy ? '…' : '+'}</Text>
          </View>
          <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 10, marginTop: 6, fontWeight: '700' }}>{busy ? 'Uploading' : 'Add story'}</Text>
        </TouchableOpacity>
        {groups.map((group, index) => (
          <TouchableOpacity key={group.userId} onPress={() => setViewerGroupIndex(index)} style={{ alignItems: 'center', width: 66 }}>
            <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: group.isMine || group.unseenCount === 0 ? '#52627B' : BLUE, alignItems: 'center', justifyContent: 'center', padding: 3 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#1D2C48', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                {group.author?.avatar_url
                  ? <Image source={{ uri: group.author.avatar_url }} style={{ width: 52, height: 52 }} />
                  : <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 18 }}>{(group.author?.display_name || group.author?.username || 'C').slice(0, 1).toUpperCase()}</Text>}
              </View>
            </View>
            <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 10, marginTop: 5, width: 66, textAlign: 'center' }}>{group.isMine ? 'Your story' : group.author?.display_name || 'Member'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {!!message && <Text style={{ color: '#F4A6B2', fontSize: 11, marginTop: 7 }}>{message}</Text>}
      {loading && <Text style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>Loading stories…</Text>}

      <Modal visible={composerAsset !== null} animationType="slide" onRequestClose={() => { if (!busy) setComposerAsset(null); }}>
        <View style={{ flex: 1, backgroundColor: STORY_BACKGROUND, paddingTop: 48, paddingHorizontal: 18, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <TouchableOpacity disabled={busy} onPress={() => { setComposerAsset(null); setCaption(''); }}>
              <Text style={{ color: MUTED, fontWeight: '800', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>Create story</Text>
            <TouchableOpacity disabled={busy} onPress={() => void publishStory()} style={{ backgroundColor: BLUE, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9, opacity: busy ? 0.55 : 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{busy ? 'Sharing…' : 'Share'}</Text>
            </TouchableOpacity>
          </View>
          {composerAsset?.type === 'image' || composerAsset?.mimeType?.startsWith('image/') ? (
            <Image source={{ uri: composerAsset.uri }} resizeMode="contain" style={{ width: '100%', height: '58%', borderRadius: 16, backgroundColor: '#111A2B' }} />
          ) : (
            <View style={{ height: '58%', borderRadius: 16, backgroundColor: '#111A2B', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 42 }}>▶</Text>
              <Text style={{ color: MUTED, marginTop: 8 }}>Video selected · up to 30 seconds</Text>
              <Text numberOfLines={1} style={{ color: MUTED, fontSize: 11, marginTop: 5, maxWidth: '90%' }}>{composerAsset?.fileName || 'Selected video'}</Text>
            </View>
          )}
          <Text style={{ color: '#FFFFFF', fontWeight: '900', marginTop: 20, marginBottom: 8 }}>Add a caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write something about this story…"
            placeholderTextColor={MUTED}
            maxLength={500}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 92, maxHeight: 140, color: '#FFFFFF', backgroundColor: '#111A2B', borderColor: '#263650', borderWidth: 1, borderRadius: 14, padding: 13, fontSize: 14 }}
          />
          <Text style={{ color: MUTED, fontSize: 10, textAlign: 'right', marginTop: 6 }}>{caption.length}/500</Text>
          <Text style={{ color: MUTED, fontSize: 11, marginTop: 12 }}>Audience: {visibility === 'followers' ? 'Followers' : 'Public'} · Stories disappear after 24 hours.</Text>
        </View>
      </Modal>

      {viewerGroupIndex !== null && <StoryViewerModal
        groups={groups}
        initialGroupIndex={viewerGroupIndex}
        onClose={() => { setViewerGroupIndex(null); void loadStories(); }}
        onViewed={() => { void loadStories(); }}
      />}
    </View>
  );
}
