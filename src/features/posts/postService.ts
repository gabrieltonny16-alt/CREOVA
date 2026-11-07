import { requireSupabase } from '../../lib/supabase';

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
  likes: { user_id: string }[] | null;
  comments: { id: string }[] | null;
};

export async function createPost(input: {
  caption: string;
  postType?: CreovaFeedPost['post_type'];
  visibility?: CreovaFeedPost['visibility'];
}): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in before publishing.');

  const caption = input.caption.trim();
  if (!caption) throw new Error('Write something before publishing.');
  if (caption.length > 2200) throw new Error('Your caption is too long.');

  const { error } = await client.from('posts').insert({
    author_id: auth.user.id,
    caption,
    post_type: input.postType ?? 'post',
    visibility: input.visibility ?? 'public',
  });
  if (error) throw error;
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
    .select('id, author_id, caption, post_type, visibility, created_at, author:profiles!posts_author_id_fkey(username, display_name, avatar_url), likes:post_likes(user_id), comments:post_comments(id)')
    .in('author_id', authorIds)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;

  return ((data ?? []) as unknown as RawFeedPost[]).map(post => ({
    id: post.id,
    author_id: post.author_id,
    caption: post.caption,
    post_type: post.post_type,
    visibility: post.visibility,
    created_at: post.created_at,
    author: post.author,
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
