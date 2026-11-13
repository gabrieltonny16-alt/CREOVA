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

  if (existing?.status === 'rejected') {
    const { error: deleteError } = await client.from('user_follows').delete()
      .eq('follower_id', userData.user.id)
      .eq('following_id', targetUserId);
    if (deleteError) throw deleteError;
  } else if (existing) {
    return existing.status === 'pending' ? 'requested' : 'following';
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

export async function respondToFollowRequest(followerId: string, accept: boolean): Promise<void> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in.');

  const { data, error } = await client.from('user_follows')
    .update({ status: accept ? 'accepted' : 'rejected', updated_at: new Date().toISOString() })
    .eq('follower_id', followerId)
    .eq('following_id', userData.user.id)
    .eq('status', 'pending')
    .select('follower_id');

  if (error) throw error;
  if (!data?.length) throw new Error('This follow request is no longer pending.');
}


export type CreovaProfileStats = {
  followers: number;
  following: number;
};

export async function getMyProfileStats(): Promise<CreovaProfileStats> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in.');

  const userId = userData.user.id;
  const [followersResult, followingResult] = await Promise.all([
    client.from('user_follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', userId)
      .eq('status', 'accepted'),
    client.from('user_follows')
      .select('following_id', { count: 'exact', head: true })
      .eq('follower_id', userId)
      .eq('status', 'accepted'),
  ]);

  if (followersResult.error) throw followersResult.error;
  if (followingResult.error) throw followingResult.error;

  return {
    followers: followersResult.count ?? 0,
    following: followingResult.count ?? 0,
  };
}


export async function uploadMyAvatar(
  localUri: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<CreovaProfile> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in.');

  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = userData.user.id + '/' + Date.now() + '.' + extension;
  const response = await fetch(localUri);
  if (!response.ok) throw new Error('Could not read the selected image.');
  const fileBuffer = await response.arrayBuffer();

  const { error: uploadError } = await client.storage
    .from('creova-avatars')
    .upload(objectPath, fileBuffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = client.storage
    .from('creova-avatars')
    .getPublicUrl(objectPath);

  const { data, error } = await client.from('profiles').update({
    avatar_url: publicUrlData.publicUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', userData.user.id).select('*').single();

  if (error) {
    await client.storage.from('creova-avatars').remove([objectPath]);
    throw error;
  }

  return data as CreovaProfile;
}

export type CreovaPublicProfile = Pick<
  CreovaProfile,
  'id' | 'username' | 'display_name' | 'bio' | 'avatar_url' | 'is_private'
> & {
  followers: number;
  following: number;
  follow_state: 'not_following' | 'pending' | 'accepted' | 'rejected';
};

export type CreovaConnection = Pick<
  CreovaProfile,
  'id' | 'username' | 'display_name' | 'avatar_url' | 'is_private'
>;

export async function getProfileByUsername(username: string): Promise<CreovaPublicProfile> {
  const { data, error } = await requireSupabase()
    .rpc('get_creova_profile_overview', { target_username: username.trim().toLowerCase() });
  if (error) throw error;
  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile) throw new Error('CREOVA profile not found.');
  return profile as CreovaPublicProfile;
}

export async function getProfileConnections(
  profileId: string,
  type: 'followers' | 'following',
): Promise<CreovaConnection[]> {
  const { data, error } = await requireSupabase()
    .rpc('get_creova_profile_connections', {
      target_profile_id: profileId,
      connection_type: type,
    });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.user_id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    is_private: row.is_private,
  }));
}

