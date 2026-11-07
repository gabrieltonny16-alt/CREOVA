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
  const { error } = await client.from('user_follows').upsert({
    follower_id: userData.user.id,
    following_id: targetUserId,
    status,
  }, { onConflict: 'follower_id,following_id' });
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
  const { error } = await client.from('user_follows').update({ status: accept ? 'accepted' : 'rejected' })
    .eq('follower_id', followerId).eq('status', 'pending');
  if (error) throw error;
}
