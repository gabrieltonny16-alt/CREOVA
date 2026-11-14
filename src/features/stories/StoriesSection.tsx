import React, { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  createStory,
  deleteStory,
  getActiveStoryGroups,
  getStoryViewers,
  recordStoryView,
} from './storyService';
import type { CreovaStory, CreovaStoryGroup, CreovaStoryViewer } from './storyService';

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
          {!!message && <Text style={{ position: 'absolute', bottom: 18, left: 16, right: 16, color: '#FFFFFF', textAlign: 'center' }}>{message}</Text>}
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
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);

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
    if (busy) return;
    setBusy(true);
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
      const asset = result.assets[0];
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
      await createStory({ uri: asset.uri, mimeType, fileSize: asset.fileSize ?? null, durationSeconds });
      await loadStories();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create your story.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ marginBottom: 18 }}>
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
      {viewerGroupIndex !== null && <StoryViewerModal
        groups={groups}
        initialGroupIndex={viewerGroupIndex}
        onClose={() => { setViewerGroupIndex(null); void loadStories(); }}
        onViewed={() => { void loadStories(); }}
      />}
    </View>
  );
}
