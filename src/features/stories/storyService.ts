import { requireSupabase } from '../../lib/supabase';

const STORY_BUCKET = 'creova-stories';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export type StoryMediaType = 'image' | 'video';

export type StoryAuthor = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type CreovaStory = {
  id: string;
  user_id: string;
  signedUrl: string;
  mediaType: StoryMediaType;
  durationSeconds: number | null;
  caption: string;
  created_at: string;
  expires_at: string;
  author: StoryAuthor | null;
  viewedByMe: boolean;
  viewCount: number;
};

export type CreovaStoryGroup = {
  userId: string;
  author: StoryAuthor | null;
  stories: CreovaStory[];
  isMine: boolean;
  unseenCount: number;
};

type RawStory = {
  id: string;
  user_id: string;
  object_path: string;
  media_type: StoryMediaType;
  duration_seconds: number | null;
  caption: string;
  created_at: string;
  expires_at: string;
  author: StoryAuthor | null;
  views: { viewer_id: string }[] | null;
};

export type StoryMediaInput = {
  uri: string;
  mimeType: string;
  fileSize: number | null;
  durationSeconds: number | null;
};

export type CreovaStoryViewer = {
  viewer_id: string;
  viewed_at: string;
  viewer: { username: string; display_name: string; avatar_url: string | null } | null;
};

function requireMediaType(mimeType: string): StoryMediaType {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return 'image';
  if (['video/mp4', 'video/quicktime', 'video/webm'].includes(mimeType)) return 'video';
  throw new Error('Choose a JPEG, PNG, WebP, MP4, MOV, or WebM file.');
}

export async function createStory(input: StoryMediaInput & { caption?: string; visibility?: 'public' | 'followers' }): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in before sharing a story.');

  const mediaType = requireMediaType(input.mimeType);
  const maximumBytes = mediaType === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (input.fileSize !== null && input.fileSize > maximumBytes) {
    throw new Error(mediaType === 'image' ? 'Images must be 10 MB or smaller.' : 'Videos must be 25 MB or smaller.');
  }
  if (mediaType === 'video' && (!input.durationSeconds || input.durationSeconds > MAX_VIDEO_SECONDS)) {
    throw new Error('Story videos must be 30 seconds or shorter.');
  }
  const caption = (input.caption ?? '').trim();
  if (caption.length > 500) throw new Error('Story captions can be up to 500 characters.');

  const extension = input.mimeType.split('/')[1]?.replace('quicktime', 'mov') ?? (mediaType === 'image' ? 'jpg' : 'mp4');
  const objectId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const objectPath = `${auth.user.id}/${objectId}.${extension}`;
  const fileResponse = await fetch(input.uri);
  if (!fileResponse.ok) throw new Error('Could not read the selected story media.');
  const file = await fileResponse.blob();
  if (file.size > maximumBytes) throw new Error(mediaType === 'image' ? 'Images must be 10 MB or smaller.' : 'Videos must be 25 MB or smaller.');

  const { error: uploadError } = await client.storage.from(STORY_BUCKET).upload(objectPath, file, {
    contentType: input.mimeType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const createdAt = new Date();
  const { error: insertError } = await client.from('stories').insert({
    user_id: auth.user.id,
    object_path: objectPath,
    media_type: mediaType,
    mime_type: input.mimeType,
    file_size_bytes: file.size,
    duration_seconds: mediaType === 'video' ? input.durationSeconds : null,
    caption,
    visibility: input.visibility ?? 'public',
    expires_at: new Date(createdAt.getTime() + STORY_LIFETIME_MS).toISOString(),
  });
  if (insertError) {
    await client.storage.from(STORY_BUCKET).remove([objectPath]);
    throw insertError;
  }
}

export async function getActiveStoryGroups(): Promise<CreovaStoryGroup[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view stories.');

  const { data: follows, error: followsError } = await client.from('user_follows')
    .select('following_id')
    .eq('follower_id', auth.user.id)
    .eq('status', 'accepted');
  if (followsError) throw followsError;
  const authorIds = [...new Set([auth.user.id, ...(follows ?? []).map(row => row.following_id)])];

  const { data, error } = await client.from('stories')
    .select('id, user_id, object_path, media_type, duration_seconds, caption, created_at, expires_at, author:profiles!stories_user_id_fkey(id, username, display_name, avatar_url), views:story_views(viewer_id)')
    .in('user_id', authorIds)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rawStories = (data ?? []) as unknown as RawStory[];
  if (!rawStories.length) return [];
  const paths = rawStories.map(story => story.object_path);
  const { data: signedUrls, error: signedError } = await client.storage.from(STORY_BUCKET).createSignedUrls(paths, 3600);
  if (signedError) throw signedError;
  const signedByPath = new Map<string, string>();
  (signedUrls ?? []).forEach(item => {
    if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
  });

  const grouped = new Map<string, CreovaStoryGroup>();
  rawStories.forEach(raw => {
    const signedUrl = signedByPath.get(raw.object_path);
    if (!signedUrl) return;
    const story: CreovaStory = {
      id: raw.id,
      user_id: raw.user_id,
      signedUrl,
      mediaType: raw.media_type,
      durationSeconds: raw.duration_seconds,
      caption: raw.caption ?? '',
      created_at: raw.created_at,
      expires_at: raw.expires_at,
      author: raw.author,
      viewedByMe: (raw.views ?? []).some(view => view.viewer_id === auth.user.id),
      viewCount: raw.user_id === auth.user.id ? (raw.views ?? []).length : 0,
    };
    const group = grouped.get(raw.user_id) ?? {
      userId: raw.user_id,
      author: raw.author,
      stories: [],
      isMine: raw.user_id === auth.user.id,
      unseenCount: 0,
    };
    group.stories.push(story);
    if (!group.isMine && !story.viewedByMe) group.unseenCount += 1;
    grouped.set(raw.user_id, group);
  });

  return [...grouped.values()].sort((a, b) => {
    if (a.isMine) return -1;
    if (b.isMine) return 1;
    return new Date(b.stories[b.stories.length - 1].created_at).getTime()
      - new Date(a.stories[a.stories.length - 1].created_at).getTime();
  });
}

export async function recordStoryView(storyId: string): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view stories.');
  const { error } = await client.from('story_views').upsert(
    { story_id: storyId, viewer_id: auth.user.id },
    { onConflict: 'story_id,viewer_id', ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function getStoryViewers(storyId: string): Promise<CreovaStoryViewer[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('story_views')
    .select('viewer_id, viewed_at, viewer:profiles!story_views_viewer_id_fkey(username, display_name, avatar_url)')
    .eq('story_id', storyId)
    .order('viewed_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as CreovaStoryViewer[];
}

export async function deleteStory(storyId: string): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to delete a story.');
  const { data: story, error: lookupError } = await client.from('stories')
    .select('object_path')
    .eq('id', storyId)
    .eq('user_id', auth.user.id)
    .single();
  if (lookupError) throw lookupError;
  const { error: storageError } = await client.storage.from(STORY_BUCKET).remove([story.object_path]);
  if (storageError) throw storageError;
  const { error: deleteError } = await client.from('stories').delete()
    .eq('id', storyId)
    .eq('user_id', auth.user.id);
  if (deleteError) throw deleteError;
}
