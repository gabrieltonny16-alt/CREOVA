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
  media: { id: string; object_path: string; width: number | null; height: number | null; position: number }[] | null;
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

export async function createPostWithImages(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
  images: PostImageInput[];
}): Promise<void> {
  if (!input.images.length) throw new Error('Choose at least one photo.');
  if (input.images.length > 10) throw new Error('A post can contain up to 10 photos.');

  const client = requireSupabase();
  for (const image of input.images) {
    const mimeType = image.mimeType.toLowerCase();
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType)) {
      throw new Error('Use JPEG, PNG, or WebP photos.');
    }
    if (image.fileSize !== null && image.fileSize > MAX_IMAGE_BYTES) {
      throw new Error('Each photo must be smaller than 10 MB.');
    }
  }

  const { id: postId, userId } = await insertPost(input);
  const uploadedPaths: string[] = [];
  try {
    for (let position = 0; position < input.images.length; position += 1) {
      const image = input.images[position];
      const mimeType = image.mimeType.toLowerCase();
      const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `image-${Date.now()}-${position}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
      const objectPath = `${userId}/${postId}/${fileName}`;

      const response = await fetch(image.uri);
      if (!response.ok) throw new Error('Could not read a selected photo from your device.');
      const fileBody = await response.arrayBuffer();
      if (fileBody.byteLength > MAX_IMAGE_BYTES) throw new Error('Each photo must be smaller than 10 MB.');

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
        media_type: 'image',
        mime_type: mimeType,
        file_size_bytes: fileBody.byteLength,
        width: image.width || null,
        height: image.height || null,
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

export async function createPostWithImage(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
  image: PostImageInput;
}): Promise<void> {
  return createPostWithImages({ ...input, images: [input.image] });
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
    .select('id, author_id, caption, post_type, visibility, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url), media:post_media(id, object_path, width, height, position), likes:post_likes(user_id), comments:post_comments(id)')
    .in('author_id', authorIds)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;

  const rawPosts = (data ?? []) as unknown as RawFeedPost[];
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
    post_type: post.post_type,
    visibility: post.visibility,
    created_at: post.created_at,
    author: post.author,
    media: (post.media ?? []).flatMap(item => {
      const signedUrl = signedByPath.get(item.object_path);
      return signedUrl ? [{ id: item.id, signedUrl, width: item.width, height: item.height, position: item.position }] : [];
    }).sort((a, b) => a.position - b.position),
    likeCount: post.likes?.length ?? 0,
    commentCount: post.comments?.length ?? 0,
    likedByMe: post.likes?.some(like => like.user_id === auth.user.id) ?? false,
  }));
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

  const { error } = await client
    .from('comment_reactions')
    .upsert({
      comment_id: commentId,
      user_id: auth.user.id,
      reaction_type: reactionType,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'comment_id,user_id' });
  if (error) throw error;
}
