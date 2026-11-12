import { requireSupabase } from '../../lib/supabase';

export type CreovaProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  is_private: boolean;
  created_at: string;
};

export async function getMyProfile(): Promise<CreovaProfile> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in.');
  const { data, error } = await client.from('profiles').select('*').eq('id', userData.user.id).single();
  if (error) throw error;
  return data as CreovaProfile;
}

export async function updateMyProfile(input: Pick<CreovaProfile, 'display_name' | 'bio' | 'is_private'>): Promise<CreovaProfile> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in.');
  const { data, error } = await client.from('profiles').update({
    display_name: input.display_name.trim(),
    bio: input.bio.trim(),
    is_private: input.is_private,
    updated_at: new Date().toISOString(),
  }).eq('id', userData.user.id).select('*').single();
  if (error) throw error;
  return data as CreovaProfile;
}

export async function searchProfiles(search: string): Promise<Pick<CreovaProfile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_private'>[]> {
  const query = search.trim().replace(/[%_,]/g, '');
  if (query.length < 2) return [];
  const { data, error } = await requireSupabase().from('profiles')
    .select('id, username, display_name, avatar_url, is_private')
    .ilike('username', `%${query}%`)
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export type FollowState = 'none' | 'requested' | 'following';

export async function getFollowStates(targetUserIds: string[]): Promise<Record<string, FollowState>> {
  if (!targetUserIds.length) return {};
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('You must be signed in.');

  const { data, error } = await client.from('user_follows')
    .select('following_id, status')
    .eq('follower_id', auth.user.id)
    .in('following_id', targetUserIds);
  if (error) throw error;

  const states: Record<string, FollowState> = {};
  for (const relation of data ?? []) {
    if (relation.status === 'accepted') states[relation.following_id] = 'following';
    else if (relation.status === 'pending') states[relation.following_id] = 'requested';
  }
  return states;
}

export async function followProfile(targetUserId: string): Promise<'requested' | 'following'> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in.');
  if (userData.user.id === targetUserId) throw new Error('You cannot follow your own account.');
  const { data: target, error: targetError } = await client.from('profiles').select('is_private').eq('id', targetUserId).single();
  if (targetError) throw targetError;
  const status = target.is_private ? 'pending' : 'accepted';
  const { data: existing, error: existingError } = await client.from('user_follows')
    .select('status')
    .eq('follower_id', userData.user.id)
    .eq('following_id', targetUserId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === 'accepted') return 'following';
  if (existing?.status === 'pending') return 'requested';
  if (existing?.status === 'rejected') {
    const { error: deleteError } = await client.from('user_follows').delete()
      .eq('follower_id', userData.user.id)
      .eq('following_id', targetUserId)
      .eq('status', 'rejected');
    if (deleteError) throw deleteError;
  }

  const { error } = await client.from('user_follows').insert({
    follower_id: userData.user.id,
    following_id: targetUserId,
    status,
  });
  if (error) throw error;
  return status === 'pending' ? 'requested' : 'following';
}

export async function unfollowProfile(targetUserId: string): Promise<void> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in.');
  const { error } = await client.from('user_follows').delete()
    .eq('follower_id', userData.user.id).eq('following_id', targetUserId);
  if (error) throw error;
}

export type IncomingFollowRequest = {
  follower_id: string;
  created_at: string;
  follower: Pick<CreovaProfile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
};

export async function getIncomingFollowRequests(): Promise<IncomingFollowRequest[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('You must be signed in.');

  const { data, error } = await client.from('user_follows')
    .select('follower_id, created_at, follower:profiles!user_follows_follower_id_fkey(id, username, display_name, avatar_url)')
    .eq('following_id', auth.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    follower_id: row.follower_id,
    created_at: row.created_at,
    follower: row.follower,
  })) as IncomingFollowRequest[];
}

export async function respondToFollowRequest(followerId: string, accept: boolean): Promise<void> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('You must be signed in.');
  const { data, error } = await client.from('user_follows').update({ status: accept ? 'accepted' : 'rejected' })
    .eq('follower_id', followerId)
    .eq('following_id', auth.user.id)
    .eq('status', 'pending')
    .select('follower_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This follow request is no longer available.');
}


export type CreovaProfileCounts = {
  posts: number;
  followers: number;
  following: number;
};

export async function getMyProfileCounts(): Promise<CreovaProfileCounts> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('You must be signed in.');

  const userId = auth.user.id;
  const [posts, followers, following] = await Promise.all([
    client.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    client.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted'),
    client.from('user_follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
  ]);

  const failed = [posts, followers, following].find(result => result.error);
  if (failed?.error) throw failed.error;
  return {
    posts: posts.count ?? 0,
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}


export type FollowListEntry = Pick<CreovaProfile, 'id' | 'username' | 'display_name' | 'avatar_url'> & { followedAt: string };

export async function getMyFollowList(kind: 'followers' | 'following'): Promise<FollowListEntry[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('You must be signed in.');

  const isFollowers = kind === 'followers';
  const query = isFollowers
    ? client.from('user_follows')
        .select('created_at, profile:profiles!user_follows_follower_id_fkey(id, username, display_name, avatar_url)')
        .eq('following_id', auth.user.id)
    : client.from('user_follows')
        .select('created_at, profile:profiles!user_follows_following_id_fkey(id, username, display_name, avatar_url)')
        .eq('follower_id', auth.user.id);

  const { data, error } = await query.eq('status', 'accepted').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((row: any) => row.profile)
    .map((row: any) => ({ ...row.profile, followedAt: row.created_at })) as FollowListEntry[];
}

export async function uploadMyAvatar(input: { uri: string; mimeType: string }): Promise<CreovaProfile> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('You must be signed in.');

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(input.mimeType)) throw new Error('Choose a JPEG, PNG, or WebP image.');

  const response = await fetch(input.uri);
  if (!response.ok) throw new Error('Could not read the selected image.');
  const fileData = await response.arrayBuffer();
  if (fileData.byteLength > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');

  const extension = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${auth.user.id}/avatar.${extension}`;
  const { error: uploadError } = await client.storage.from('profile-avatars').upload(path, fileData, {
    contentType: input.mimeType,
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data: publicData } = client.storage.from('profile-avatars').getPublicUrl(path);
  const { data, error } = await client.from('profiles').update({
    avatar_url: publicData.publicUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', auth.user.id).select('*').single();
  if (error) throw error;
  return data as CreovaProfile;
}

export async function removeMyAvatar(): Promise<CreovaProfile> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('You must be signed in.');

  const current = await getMyProfile();
  const { data, error } = await client.from('profiles').update({
    avatar_url: null,
    updated_at: new Date().toISOString(),
  }).eq('id', auth.user.id).select('*').single();
  if (error) throw error;

  const marker = '/profile-avatars/';
  const markerIndex = current.avatar_url?.indexOf(marker) ?? -1;
  if (markerIndex >= 0 && current.avatar_url) {
    const path = decodeURIComponent(current.avatar_url.slice(markerIndex + marker.length).split('?')[0]);
    const { error: removeError } = await client.storage.from('profile-avatars').remove([path]);
    if (removeError) throw removeError;
  }
  return data as CreovaProfile;
}
