import { requireSupabase } from '../../lib/supabase';

const STORIES_BUCKET = 'creova-stories';
const MAX_STORY_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export type StoryMediaInput = {
  uri: string;
  mimeType: string;
  fileSize: number | null;
};

export type CreovaStory = {
  id: string;
  user_id: string;
  media_path: string;
  media_type: 'image' | 'video';
  caption: string;
  visibility: 'public' | 'followers';
  created_at: string;
  expires_at: string;
  mediaUrl: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  viewedByMe: boolean;
  viewerCount: number;
};

type RawStory = Omit<CreovaStory, 'mediaUrl' | 'viewedByMe' | 'viewerCount'> & {
  story_views: { viewer_id: string; viewed_at: string }[] | null;
};

function makeUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'video/mp4': return 'mp4';
    case 'video/quicktime': return 'mov';
    case 'video/webm': return 'webm';
    default: throw new Error('Choose a JPEG, PNG, WebP, MP4, MOV, or WebM file.');
  }
}

export async function publishStory(input: {
  media: StoryMediaInput;
  caption?: string;
  visibility?: 'public' | 'followers';
}): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in before publishing a story.');

  const mimeType = input.media.mimeType.toLowerCase();
  const isImage = IMAGE_TYPES.includes(mimeType);
  const isVideo = VIDEO_TYPES.includes(mimeType);
  if (!isImage && !isVideo) throw new Error('Choose a supported photo or video.');
  if (input.media.fileSize !== null && input.media.fileSize > MAX_STORY_BYTES) {
    throw new Error('Stories must be 50 MB or smaller.');
  }

  const caption = (input.caption ?? '').trim();
  if (caption.length > 500) throw new Error('Story captions must be 500 characters or fewer.');

  const storyId = makeUuid();
  const objectPath = `${auth.user.id}/${storyId}/story-${Date.now()}.${getExtension(mimeType)}`;
  const { error: insertError } = await client.from('stories').insert({
    id: storyId,
    user_id: auth.user.id,
    media_path: objectPath,
    media_type: isImage ? 'image' : 'video',
    caption,
    visibility: input.visibility ?? 'followers',
  });
  if (insertError) throw insertError;

  try {
    const response = await fetch(input.media.uri);
    if (!response.ok) throw new Error('Could not read the selected media from your device.');
    const fileBody = await response.arrayBuffer();
    if (fileBody.byteLength > MAX_STORY_BYTES) throw new Error('Stories must be 50 MB or smaller.');

    const { error: uploadError } = await client.storage.from(STORIES_BUCKET).upload(objectPath, fileBody, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw uploadError;
  } catch (error) {
    await client.from('stories').delete().eq('id', storyId).eq('user_id', auth.user.id);
    throw error;
  }
}

export async function getActiveStories(): Promise<CreovaStory[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view stories.');

  const { data, error } = await client
    .from('stories')
    .select('id, user_id, media_path, media_type, caption, visibility, created_at, expires_at, author:profiles!stories_user_id_fkey(id, username, display_name, avatar_url), story_views(viewer_id, viewed_at)')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawStory[];
  if (!rows.length) return [];

  const paths = rows.map(story => story.media_path);
  const { data: signed, error: signedError } = await client.storage
    .from(STORIES_BUCKET)
    .createSignedUrls(paths, 3600);
  if (signedError) throw signedError;

  const signedByPath = new Map<string, string>();
  (signed ?? []).forEach(item => {
    if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
  });

  return rows.flatMap(story => {
    const mediaUrl = signedByPath.get(story.media_path);
    if (!mediaUrl) return [];
    const views = story.story_views ?? [];
    return [{
      id: story.id,
      user_id: story.user_id,
      media_path: story.media_path,
      media_type: story.media_type,
      caption: story.caption,
      visibility: story.visibility,
      created_at: story.created_at,
      expires_at: story.expires_at,
      mediaUrl,
      author: story.author,
      viewedByMe: views.some(view => view.viewer_id === auth.user.id),
      viewerCount: story.user_id === auth.user.id ? views.length : 0,
    }];
  });
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view stories.');

  const { error } = await client.from('story_views').upsert(
    { story_id: storyId, viewer_id: auth.user.id, viewed_at: new Date().toISOString() },
    { onConflict: 'story_id,viewer_id', ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function reactToStory(
  storyId: string,
  reaction: '❤️' | '😂' | '😮' | '😢' | '🔥' | '👏',
): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to react to stories.');

  const { error } = await client.from('story_reactions').upsert(
    { story_id: storyId, user_id: auth.user.id, reaction },
    { onConflict: 'story_id,user_id' },
  );
  if (error) throw error;
}

export async function replyToStory(storyId: string, message: string): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to reply to stories.');

  const body = message.trim();
  if (!body) throw new Error('Write a reply first.');
  if (body.length > 1000) throw new Error('Replies must be 1,000 characters or fewer.');

  const { error } = await client.from('story_replies').insert({
    story_id: storyId,
    sender_id: auth.user.id,
    body,
  });
  if (error) throw error;
}

export async function getMyStoryViewers(storyId: string): Promise<Array<{
  viewer_id: string;
  viewed_at: string;
  viewer: { username: string; display_name: string; avatar_url: string | null } | null;
}>> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view story viewers.');

  const { data, error } = await client.from('story_views')
    .select('viewer_id, viewed_at, viewer:profiles!story_views_viewer_id_fkey(username, display_name, avatar_url), story:stories!inner(user_id)')
    .eq('story_id', storyId)
    .eq('story.user_id', auth.user.id)
    .order('viewed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(({ viewer_id, viewed_at, viewer }) => ({
    viewer_id,
    viewed_at,
    viewer: (Array.isArray(viewer) ? viewer[0] : viewer) as unknown as { username: string; display_name: string; avatar_url: string | null } | null,
  }));
}

export async function deleteStory(storyId: string): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to delete stories.');

  const { data: story, error: lookupError } = await client.from('stories')
    .select('media_path').eq('id', storyId).eq('user_id', auth.user.id).single();
  if (lookupError) throw lookupError;

  const { error: storageError } = await client.storage.from(STORIES_BUCKET).remove([story.media_path]);
  if (storageError) throw storageError;
  const { error: deleteError } = await client.from('stories')
    .delete().eq('id', storyId).eq('user_id', auth.user.id);
  if (deleteError) throw deleteError;
}
