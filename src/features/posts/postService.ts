import * as tus from 'tus-js-client';
import { Platform } from 'react-native';
import { requireSupabase, supabaseUrl } from '../../lib/supabase';

const MEDIA_BUCKET = 'creova-media';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 60;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export type CreovaPostMedia = {
  id: string;
  signedUrl: string;
  width: number | null;
  height: number | null;
  position: number;
  mediaType: 'image' | 'video';
  durationSeconds: number | null;
};

export type CreovaFeedPost = {
  id: string;
  author_id: string;
  caption: string;
  post_type: 'post' | 'anchor' | 'iteration';
  visibility: 'public' | 'followers';
  created_at: string;
  author: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  media: CreovaPostMedia[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

type RawFeedPost = {
  id: string;
  author_id: string;
  caption: string;
  post_type: CreovaFeedPost['post_type'];
  visibility: CreovaFeedPost['visibility'];
  created_at: string;
  author: CreovaFeedPost['author'];
  media: { id: string; object_path: string; media_type: 'image' | 'video'; width: number | null; height: number | null; duration_seconds: number | null; position: number }[] | null;
  likes: { user_id: string }[] | null;
  comments: { id: string }[] | null;
};

export type PostImageInput = {
  uri: string;
  mimeType: string;
  fileSize: number | null;
  width: number;
  height: number;
};

async function insertPost(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
}): Promise<{ id: string; userId: string }> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in before publishing.');

  const caption = input.caption.trim();
  if (caption.length > 2200) throw new Error('Your caption is too long.');

  const { data, error } = await client.from('posts').insert({
    author_id: auth.user.id,
    caption,
    post_type: input.postType ?? 'post',
    visibility: input.visibility ?? 'public',
  }).select('id').single();
  if (error) throw error;
  return { id: data.id, userId: auth.user.id };
}

export async function createPost(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
}): Promise<void> {
  if (!input.caption.trim()) throw new Error('Write something before publishing.');
  await insertPost(input);
}

type MediaUploadProgress = (percentage: number) => void;

let activeTusUpload: tus.Upload | null = null;
let rejectActiveTusUpload: ((error: Error) => void) | null = null;

export function cancelActivePostMediaUpload(): boolean {
  const upload = activeTusUpload;
  const reject = rejectActiveTusUpload;
  if (!upload || !reject) return false;
  activeTusUpload = null;
  rejectActiveTusUpload = null;
  void upload.abort(true).catch(() => undefined);
  reject(new Error('Upload cancelled.'));
  return true;
}

// React Native tus-js-client retries within the active app session; its built-in URL storage is not available across app restarts.
async function uploadMediaResumable(
  uri: string,
  objectPath: string,
  mimeType: string,
  fileSize: number | null,
  onProgress?: MediaUploadProgress,
): Promise<number> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError) throw authError;
  if (!auth.session?.access_token) throw new Error('Your session expired. Sign in again before uploading.');

  const configuredUrl = new URL(supabaseUrl);
  const storageHost = configuredUrl.hostname.endsWith('.supabase.co')
    ? configuredUrl.hostname.replace('.supabase.co', '.storage.supabase.co')
    : configuredUrl.hostname;
  const endpoint = `https://${storageHost}/storage/v1/upload/resumable`;
  const fileName = objectPath.split('/').pop() ?? 'creova-media';
  const file = Platform.OS === 'web'
    ? await (await fetch(uri)).blob()
    : ({ uri, name: fileName, type: mimeType, ...(fileSize !== null ? { size: fileSize } : {}) } as unknown as File);

  return new Promise<number>((resolve, reject) => {
    let totalBytes = fileSize ?? 0;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      activeTusUpload = null;
      rejectActiveTusUpload = null;
      if (error) reject(error);
      else resolve(totalBytes);
    };

    const upload = new tus.Upload(file, {
      endpoint,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${auth.session.access_token}`,
        apikey: client.supabaseKey,
      },
      uploadDataDuringCreation: true,
      metadata: {
        bucketName: MEDIA_BUCKET,
        objectName: objectPath,
        contentType: mimeType,
        cacheControl: '3600',
      },
      onError: error => finish(error instanceof Error ? error : new Error(String(error))),
      onProgress: (uploadedBytes, total) => {
        if (total > 0) {
          totalBytes = total;
          onProgress?.(Math.min(100, (uploadedBytes / total) * 100));
        }
      },
      onSuccess: () => {
        onProgress?.(100);
        finish();
      },
    });

    activeTusUpload = upload;
    rejectActiveTusUpload = error => finish(error);
    upload.start();
  });
}

export type PostMediaInput = {
  uri: string;
  mimeType: string;
  fileSize: number | null;
  width: number;
  height: number;
  mediaType: 'image' | 'video';
  durationSeconds: number | null;
};

export async function createPostWithMedia(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
  media: PostMediaInput;
}, onProgress?: MediaUploadProgress): Promise<void> {
  const client = requireSupabase();
  const mimeType = input.media.mimeType.toLowerCase();
  const isImage = input.media.mediaType === 'image';
  const allowedTypes = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;

  if (!(allowedTypes as readonly string[]).includes(mimeType)) {
    throw new Error(isImage
      ? 'Use a JPEG, PNG, or WebP image.'
      : 'Use an MP4, MOV, or WebM video.');
  }
  if (input.media.fileSize !== null && input.media.fileSize > maxBytes) {
    throw new Error(isImage
      ? 'Choose an image smaller than 10 MB.'
      : 'Choose a video smaller than 50 MB.');
  }
  if (!isImage && input.media.durationSeconds !== null && input.media.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error('Choose a video that is 60 seconds or shorter.');
  }

  const { id: postId, userId } = await insertPost(input);
  const extension = mimeType === 'image/png' ? 'png'
    : mimeType === 'image/webp' ? 'webp'
    : mimeType === 'video/quicktime' ? 'mov'
    : mimeType === 'video/webm' ? 'webm'
    : mimeType === 'video/mp4' ? 'mp4' : 'jpg';
  const fileName = `${input.media.mediaType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
  const objectPath = `${userId}/${postId}/${fileName}`;

  try {
    const uploadedBytes = await uploadMediaResumable(input.media.uri, objectPath, mimeType, input.media.fileSize, onProgress);
    if (uploadedBytes <= 0) throw new Error('Could not determine the selected media size. Please choose the file again.');

    const { error: metadataError } = await client.from('post_media').insert({
      post_id: postId,
      object_path: objectPath,
      media_type: input.media.mediaType,
      mime_type: mimeType,
      file_size_bytes: uploadedBytes,
      width: input.media.width || null,
      height: input.media.height || null,
      duration_seconds: input.media.durationSeconds,
      position: 0,
    });
    if (metadataError) throw metadataError;
  } catch (error) {
    await client.storage.from(MEDIA_BUCKET).remove([objectPath]);
    await client.from('posts').delete().eq('id', postId);
    throw error;
  }
}

export async function createPostWithImage(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
  image: PostImageInput;
}): Promise<void> {
  return createPostWithMedia({
    caption: input.caption,
    postType: input.postType,
    visibility: input.visibility,
    media: { ...input.image, mediaType: 'image', durationSeconds: null },
  });
}

function hydratePostRows(rawPosts: RawFeedPost[], viewerId: string): Promise<CreovaFeedPost[]> {
  const client = requireSupabase();
  const paths = rawPosts.flatMap(post => post.media?.map(media => media.object_path) ?? []);
  return (async () => {
    const signedByPath = new Map<string, string>();
    if (paths.length) {
      const { data: signed, error: signedError } = await client.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 3600);
      if (signedError) throw signedError;
      (signed ?? []).forEach(item => {
        if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
      });
    }

    return rawPosts.map(post => ({
      id: post.id,
      author_id: post.author_id,
      caption: post.caption,
      post_type: post.post_type,
      visibility: post.visibility,
      created_at: post.created_at,
      author: post.author,
      media: (post.media ?? []).flatMap(item => {
        const signedUrl = signedByPath.get(item.object_path);
        return signedUrl ? [{
          id: item.id,
          signedUrl,
          width: item.width,
          height: item.height,
          position: item.position,
          mediaType: item.media_type,
          durationSeconds: item.duration_seconds,
        }] : [];
      }).sort((a, b) => a.position - b.position),
      likeCount: post.likes?.length ?? 0,
      commentCount: post.comments?.length ?? 0,
      likedByMe: post.likes?.some(like => like.user_id === viewerId) ?? false,
    }));
  })();
}

export async function getHomeFeed(): Promise<CreovaFeedPost[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view your feed.');

  const { data: follows, error: followsError } = await client
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', auth.user.id)
    .eq('status', 'accepted');
  if (followsError) throw followsError;

  const authorIds = [auth.user.id, ...(follows ?? []).map(row => row.following_id)];
  const { data, error } = await client
    .from('posts')
    .select('id, author_id, caption, post_type, visibility, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url), media:post_media(id, object_path, media_type, width, height, duration_seconds, position), likes:post_likes(user_id), comments:post_comments(id)')
    .in('author_id', authorIds)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;

  const rawPosts = (data ?? []) as unknown as RawFeedPost[];
  return hydratePostRows(rawPosts, auth.user.id);
}

export async function togglePostLike(postId: string): Promise<boolean> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to like posts.');

  const { data: existing, error: lookupError } = await client
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await client.from('post_likes')
      .delete().eq('post_id', postId).eq('user_id', auth.user.id);
    if (error) throw error;
    return false;
  }

  const { error } = await client.from('post_likes').insert({
    post_id: postId,
    user_id: auth.user.id,
  });
  if (error) throw error;
  return true;
}

export type CreovaCommentReaction = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

export type CreovaPostComment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  author: { username: string; display_name: string; avatar_url: string | null } | null;
  reactions: { user_id: string; reaction_type: CreovaCommentReaction }[];
};

const MAX_COMMENT_LENGTH = 2000;
const COMMENT_REACTIONS: CreovaCommentReaction[] = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];

export async function getPostComments(postId: string): Promise<CreovaPostComment[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('post_comments')
    .select('id, post_id, user_id, parent_comment_id, body, created_at, updated_at, author:profiles!post_comments_user_id_fkey(username, display_name, avatar_url), reactions:comment_reactions(user_id, reaction_type)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(250);
  if (error) throw error;
  return (data ?? []) as unknown as CreovaPostComment[];
}

export async function createPostComment(postId: string, body: string, parentCommentId?: string | null): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to comment.');
  const cleanBody = body.trim();
  if (!cleanBody) throw new Error('Write a comment first.');
  if (cleanBody.length > MAX_COMMENT_LENGTH) throw new Error('Comments can be up to 2,000 characters.');
  const { error } = await client.from('post_comments').insert({
    post_id: postId,
    user_id: auth.user.id,
    parent_comment_id: parentCommentId ?? null,
    body: cleanBody,
  });
  if (error) throw error;
}

export async function updatePostComment(commentId: string, body: string): Promise<void> {
  const client = requireSupabase();
  const cleanBody = body.trim();
  if (!cleanBody) throw new Error('A comment cannot be empty.');
  if (cleanBody.length > MAX_COMMENT_LENGTH) throw new Error('Comments can be up to 2,000 characters.');
  const { error } = await client.from('post_comments')
    .update({ body: cleanBody, updated_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
}

export async function deletePostComment(commentId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('post_comments').delete().eq('id', commentId);
  if (error) throw error;
}

export async function setPostCommentReaction(
  commentId: string,
  reactionType: CreovaCommentReaction,
): Promise<CreovaCommentReaction | null> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to react.');
  if (!COMMENT_REACTIONS.includes(reactionType)) throw new Error('Unsupported reaction.');

  const { data: existing, error: lookupError } = await client.from('comment_reactions')
    .select('id, reaction_type')
    .eq('comment_id', commentId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing?.reaction_type === reactionType) {
    const { error } = await client.from('comment_reactions').delete()
      .eq('comment_id', commentId).eq('user_id', auth.user.id);
    if (error) throw error;
    return null;
  }
  if (existing) {
    // CREOVA-DEV currently grants authenticated users SELECT/INSERT/DELETE on
    // comment_reactions, but not UPDATE. Replace the user's existing reaction
    // using the granted operations rather than relying on a missing privilege.
    const { error: deleteError } = await client.from('comment_reactions').delete()
      .eq('comment_id', commentId).eq('user_id', auth.user.id);
    if (deleteError) throw deleteError;
  }
  const { error: insertError } = await client.from('comment_reactions').insert({
    comment_id: commentId,
    user_id: auth.user.id,
    reaction_type: reactionType,
  });
  if (insertError) throw insertError;
  return reactionType;
}

export async function getProfilePosts(profileId: string, limit = 60): Promise<CreovaFeedPost[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view profile posts.');

  const { data, error } = await client.from('posts')
    .select('id, author_id, caption, post_type, visibility, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url), media:post_media(id, object_path, media_type, width, height, duration_seconds, position), likes:post_likes(user_id), comments:post_comments(id)')
    .eq('author_id', profileId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw error;

  // Post RLS remains the authority for public, follower-only, and private content.
  return hydratePostRows((data ?? []) as unknown as RawFeedPost[], auth.user.id);
}

export async function getPostById(postId: string): Promise<CreovaFeedPost> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view this post.');

  const { data, error } = await client.from('posts')
    .select('id, author_id, caption, post_type, visibility, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url), media:post_media(id, object_path, media_type, width, height, duration_seconds, position), likes:post_likes(user_id), comments:post_comments(id)')
    .eq('id', postId)
    .single();
  if (error) throw error;
  const [post] = await hydratePostRows([data as unknown as RawFeedPost], auth.user.id);
  return post;
}

