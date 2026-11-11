import { requireSupabase } from '../../lib/supabase';

const MEDIA_BUCKET = 'creova-media';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type CreovaPostMedia = {
  id: string;
  signedUrl: string;
  width: number | null;
  height: number | null;
  position: number;
  mediaType: 'image' | 'video';
  mimeType: string;
  durationSeconds: number | null;
};

export type CreovaFeedPost = {
  id: string;
  author_id: string;
  caption: string;
  is_pinned: boolean;
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
  repostCount: number;
  repostedByMe: boolean;
  savedByMe: boolean;
  repostedBy: { id: string; username: string; display_name: string } | null;
  feedCreatedAt: string;
};

type RawFeedPost = {
  id: string;
  author_id: string;
  caption: string;
  is_pinned: boolean;
  post_type: CreovaFeedPost['post_type'];
  visibility: CreovaFeedPost['visibility'];
  created_at: string;
  author: CreovaFeedPost['author'];
  media: { id: string; object_path: string; media_type: 'image' | 'video'; mime_type: string; duration_seconds: number | null; width: number | null; height: number | null; position: number }[] | null;
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

export type PostMediaInput = PostImageInput & {
  mediaType?: 'image' | 'video';
  durationSeconds?: number | null;
};

export async function createPostWithMedia(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
  media: PostMediaInput[];
}): Promise<void> {
  if (!input.media.length) throw new Error('Choose at least one photo or video.');
  if (input.media.length > 10) throw new Error('A post can contain up to 10 media items.');

  const client = requireSupabase();
  for (const item of input.media) {
    const mediaType = item.mediaType ?? 'image';
    const mimeType = item.mimeType.toLowerCase();
    const allowed = mediaType === 'image'
      ? ['image/jpeg', 'image/png', 'image/webp']
      : ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!allowed.includes(mimeType)) {
      throw new Error(mediaType === 'image'
        ? 'Use JPEG, PNG, or WebP photos.'
        : 'Use MP4, MOV, or WebM videos.');
    }
    const maxBytes = mediaType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (item.fileSize !== null && item.fileSize > maxBytes) {
      throw new Error(mediaType === 'image'
        ? 'Each photo must be smaller than 10 MB.'
        : 'Each video must be smaller than 100 MB.');
    }
    if (mediaType === 'video' && item.durationSeconds != null && item.durationSeconds > 180) {
      throw new Error('Feed videos must be 3 minutes or shorter.');
    }
  }

  const { id: postId, userId } = await insertPost(input);
  const uploadedPaths: string[] = [];
  try {
    for (let position = 0; position < input.media.length; position += 1) {
      const item = input.media[position];
      const mediaType = item.mediaType ?? 'image';
      const mimeType = item.mimeType.toLowerCase();
      const extension = mimeType === 'image/png' ? 'png'
        : mimeType === 'image/webp' ? 'webp'
        : mimeType === 'video/quicktime' ? 'mov'
        : mimeType === 'video/webm' ? 'webm'
        : mediaType === 'video' ? 'mp4' : 'jpg';
      const fileName = `${mediaType}-${Date.now()}-${position}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
      const objectPath = `${userId}/${postId}/${fileName}`;

      const response = await fetch(item.uri);
      if (!response.ok) throw new Error('Could not read a selected media file from your device.');
      const fileBody = await response.arrayBuffer();
      const maxBytes = mediaType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
      if (fileBody.byteLength > maxBytes) {
        throw new Error(mediaType === 'image' ? 'Each photo must be smaller than 10 MB.' : 'Each video must be smaller than 100 MB.');
      }

      const { error: uploadError } = await client.storage.from(MEDIA_BUCKET).upload(objectPath, fileBody, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      uploadedPaths.push(objectPath);

      const { error: metadataError } = await client.from('post_media').insert({
        post_id: postId,
        object_path: objectPath,
        media_type: mediaType,
        mime_type: mimeType,
        file_size_bytes: fileBody.byteLength,
        width: item.width || null,
        height: item.height || null,
        duration_seconds: mediaType === 'video' ? item.durationSeconds ?? null : null,
        position,
      });
      if (metadataError) throw metadataError;
    }
  } catch (error) {
    if (uploadedPaths.length) await client.storage.from(MEDIA_BUCKET).remove(uploadedPaths);
    await client.from('posts').delete().eq('id', postId);
    throw error;
  }
}

export async function createPostWithImages(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
  images: PostImageInput[];
}): Promise<void> {
  return createPostWithMedia({ ...input, media: input.images });
}

export async function createPostWithImage(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
  image: PostImageInput;
}): Promise<void> {
  return createPostWithImages({ ...input, images: [input.image] });
}

async function hydrateFeedPosts(rawPosts: RawFeedPost[], userId: string): Promise<CreovaFeedPost[]> {
  if (!rawPosts.length) return [];
  const client = requireSupabase();
  const paths = rawPosts.flatMap(post => post.media?.map(media => media.object_path) ?? []);
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
    is_pinned: post.is_pinned,
    post_type: post.post_type,
    visibility: post.visibility,
    created_at: post.created_at,
    author: post.author,
    media: (post.media ?? []).flatMap(item => {
      const signedUrl = signedByPath.get(item.object_path);
      return signedUrl ? [{ id: item.id, signedUrl, width: item.width, height: item.height, position: item.position, mediaType: item.media_type, mimeType: item.mime_type, durationSeconds: item.duration_seconds }] : [];
    }).sort((a, b) => a.position - b.position),
    likeCount: post.likes?.length ?? 0,
    commentCount: post.comments?.length ?? 0,
    likedByMe: post.likes?.some(like => like.user_id === userId) ?? false,
    repostCount: 0,
    repostedByMe: false,
    savedByMe: false,
    repostedBy: null,
    feedCreatedAt: post.created_at,
  }));
}

type FeedRepostRow = {
  post_id: string;
  user_id: string;
  created_at: string;
  reposter: { id: string; username: string; display_name: string } | null;
};

const FEED_POST_SELECT = 'id, author_id, caption, is_pinned, post_type, visibility, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url), media:post_media(id, object_path, media_type, mime_type, duration_seconds, width, height, position), likes:post_likes(user_id), comments:post_comments(id)';

export async function setPostPinned(postId: string, pinned: boolean): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to pin posts.');
  const { error } = await client.rpc('set_post_pin', {
    p_post_id: postId,
    p_pinned: pinned,
  });
  if (error) throw error;
}

export async function getMyPosts(): Promise<CreovaFeedPost[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view your profile.');

  const { data, error } = await client.from('posts').select(FEED_POST_SELECT)
    .eq('author_id', auth.user.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return hydrateFeedPosts((data ?? []) as unknown as RawFeedPost[], auth.user.id);
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
  const [directResult, repostResult, savedResult] = await Promise.all([
    client.from('posts').select(FEED_POST_SELECT).in('author_id', authorIds)
      .order('created_at', { ascending: false }).limit(30),
    client.from('post_reposts')
      .select('post_id, user_id, created_at, reposter:profiles!post_reposts_user_id_fkey(id, username, display_name)')
      .in('user_id', authorIds).order('created_at', { ascending: false }).limit(60),
    client.from('post_saves').select('post_id').eq('user_id', auth.user.id),
  ]);
  if (directResult.error) throw directResult.error;
  if (repostResult.error) throw repostResult.error;
  if (savedResult.error) throw savedResult.error;

  const repostRows = (repostResult.data ?? []) as unknown as FeedRepostRow[];
  const repostPostIds = [...new Set(repostRows.map(row => row.post_id))];
  let repostedRaw: RawFeedPost[] = [];
  if (repostPostIds.length) {
    const { data, error } = await client.from('posts').select(FEED_POST_SELECT).in('id', repostPostIds);
    if (error) throw error;
    repostedRaw = (data ?? []) as unknown as RawFeedPost[];
  }

  const rawById = new Map<string, RawFeedPost>();
  for (const post of (directResult.data ?? []) as unknown as RawFeedPost[]) rawById.set(post.id, post);
  for (const post of repostedRaw) rawById.set(post.id, post);
  const hydrated = await hydrateFeedPosts([...rawById.values()], auth.user.id);
  const repostsByPost = new Map<string, FeedRepostRow[]>();
  for (const row of repostRows) {
    const current = repostsByPost.get(row.post_id) ?? [];
    current.push(row);
    repostsByPost.set(row.post_id, current);
  }
  const savedIds = new Set((savedResult.data ?? []).map(row => row.post_id));

  return hydrated.map(post => {
    const reposts = repostsByPost.get(post.id) ?? [];
    const latest = reposts[0];
    return {
      ...post,
      repostCount: reposts.length,
      repostedByMe: reposts.some(row => row.user_id === auth.user.id),
      savedByMe: savedIds.has(post.id),
      repostedBy: latest?.reposter ? { ...latest.reposter, id: latest.user_id } : null,
      feedCreatedAt: latest?.created_at ?? post.created_at,
    };
  }).sort((a, b) => new Date(b.feedCreatedAt).getTime() - new Date(a.feedCreatedAt).getTime());
}

export async function getForYouFeed(): Promise<CreovaFeedPost[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view your feed.');

  // The posts_select_visible RLS policy is the privacy boundary:
  // public posts from public profiles are discoverable; private/followers-only
  // content remains hidden unless the signed-in user is authorized.
  const [postsResult, savedResult] = await Promise.all([
    client.from('posts').select(FEED_POST_SELECT)
      .eq('visibility', 'public')
      .neq('author_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    client.from('post_saves').select('post_id').eq('user_id', auth.user.id),
  ]);
  if (postsResult.error) throw postsResult.error;
  if (savedResult.error) throw savedResult.error;

  const hydrated = await hydrateFeedPosts((postsResult.data ?? []) as unknown as RawFeedPost[], auth.user.id);
  const savedIds = new Set((savedResult.data ?? []).map(row => row.post_id));
  return hydrated.map(post => ({ ...post, savedByMe: savedIds.has(post.id) }));
}

export async function getPostById(postId: string): Promise<CreovaFeedPost> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view this post.');

  const { data, error } = await client.from('posts').select(FEED_POST_SELECT)
    .eq('id', postId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This post is unavailable or you do not have permission to view it.');

  const [repostsResult, savedResult] = await Promise.all([
    client.from('post_reposts')
      .select('post_id, user_id, created_at, reposter:profiles!post_reposts_user_id_fkey(id, username, display_name)')
      .eq('post_id', postId).order('created_at', { ascending: false }),
    client.from('post_saves').select('post_id').eq('user_id', auth.user.id).eq('post_id', postId).maybeSingle(),
  ]);
  if (repostsResult.error) throw repostsResult.error;
  if (savedResult.error) throw savedResult.error;
  const rows = (repostsResult.data ?? []) as unknown as FeedRepostRow[];
  const [post] = await hydrateFeedPosts([data as unknown as RawFeedPost], auth.user.id);
  const latest = rows[0];
  return {
    ...post,
    repostCount: rows.length,
    repostedByMe: rows.some(row => row.user_id === auth.user.id),
    savedByMe: !!savedResult.data,
    repostedBy: latest?.reposter ? { ...latest.reposter, id: latest.user_id } : null,
    feedCreatedAt: latest?.created_at ?? post.created_at,
  };
}

export async function getSavedPosts(): Promise<CreovaFeedPost[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view saved posts.');

  const { data: saved, error: savedError } = await client.from('post_saves')
    .select('post_id, created_at').eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });
  if (savedError) throw savedError;
  if (!saved?.length) return [];

  const ids = saved.map(row => row.post_id);
  const { data, error } = await client.from('posts').select(FEED_POST_SELECT).in('id', ids);
  if (error) throw error;
  const hydrated = await hydrateFeedPosts((data ?? []) as unknown as RawFeedPost[], auth.user.id);
  const byId = new Map(hydrated.map(post => [post.id, post]));
  return ids.flatMap(id => {
    const post = byId.get(id);
    return post ? [{ ...post, savedByMe: true }] : [];
  });
}

export async function togglePostRepost(postId: string): Promise<boolean> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to repost.');

  const { data: existing, error: lookupError } = await client.from('post_reposts')
    .select('post_id').eq('post_id', postId).eq('user_id', auth.user.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const { error } = await client.from('post_reposts').delete()
      .eq('post_id', postId).eq('user_id', auth.user.id);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from('post_reposts').insert({ post_id: postId, user_id: auth.user.id });
  if (error) throw error;
  return true;
}

export async function togglePostSave(postId: string): Promise<boolean> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to save posts.');

  const { data: existing, error: lookupError } = await client.from('post_saves')
    .select('post_id').eq('post_id', postId).eq('user_id', auth.user.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const { error } = await client.from('post_saves').delete()
      .eq('post_id', postId).eq('user_id', auth.user.id);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from('post_saves').insert({ post_id: postId, user_id: auth.user.id });
  if (error) throw error;
  return true;
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


export type CreovaPostComment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  author: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export async function getPostComments(postId: string): Promise<CreovaPostComment[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view comments.');

  const { data, error } = await client
    .from('post_comments')
    .select('id, post_id, user_id, parent_comment_id, body, created_at, author:profiles!post_comments_user_id_fkey(username, display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as CreovaPostComment[];
}

export async function createPostComment(input: {
  postId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to comment.');

  const body = input.body.trim();
  if (!body) throw new Error('Write a comment first.');
  if (body.length > 2000) throw new Error('Comments must be 2,000 characters or fewer.');

  const { error } = await client.from('post_comments').insert({
    post_id: input.postId,
    user_id: auth.user.id,
    parent_comment_id: input.parentCommentId ?? null,
    body,
  });
  if (error) throw error;
}


export type CommentReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

export type CommentReactionSummary = {
  comment_id: string;
  counts: Record<CommentReactionType, number>;
  total: number;
  myReaction: CommentReactionType | null;
};

const COMMENT_REACTIONS: CommentReactionType[] = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];

export async function getCommentReactionSummaries(commentIds: string[]): Promise<Record<string, CommentReactionSummary>> {
  const summaries: Record<string, CommentReactionSummary> = {};
  for (const commentId of commentIds) {
    summaries[commentId] = {
      comment_id: commentId,
      counts: { like: 0, love: 0, laugh: 0, wow: 0, sad: 0, angry: 0 },
      total: 0,
      myReaction: null,
    };
  }
  if (!commentIds.length) return summaries;

  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to view comment reactions.');

  const { data, error } = await client
    .from('comment_reactions')
    .select('comment_id, user_id, reaction_type')
    .in('comment_id', commentIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const summary = summaries[row.comment_id];
    if (!summary || !COMMENT_REACTIONS.includes(row.reaction_type as CommentReactionType)) continue;
    const reaction = row.reaction_type as CommentReactionType;
    summary.counts[reaction] += 1;
    summary.total += 1;
    if (row.user_id === auth.user.id) summary.myReaction = reaction;
  }
  return summaries;
}

export async function setCommentReaction(
  commentId: string,
  reactionType: CommentReactionType | null,
): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in to react to comments.');
  if (reactionType !== null && !COMMENT_REACTIONS.includes(reactionType)) {
    throw new Error('Choose a supported reaction.');
  }

  if (reactionType === null) {
    const { error } = await client
      .from('comment_reactions')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', auth.user.id);
    if (error) throw error;
    return;
  }

  const { data: existing, error: lookupError } = await client
    .from('comment_reactions')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await client
      .from('comment_reactions')
      .update({ reaction_type: reactionType, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('user_id', auth.user.id);
    if (error) throw error;
    return;
  }

  const { error } = await client.from('comment_reactions').insert({
    comment_id: commentId,
    user_id: auth.user.id,
    reaction_type: reactionType,
  });
  if (error) throw error;
}
