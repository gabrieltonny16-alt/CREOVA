import React, { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AuthGate } from './src/features/auth/AuthGate';
import { getMyProfile, getMyProfileStats, searchProfiles, followProfile, unfollowProfile, getProfileByUsername, getProfileConnections, updateMyProfile, uploadMyAvatar } from './src/features/profile/profileService';
import type { CreovaProfile } from './src/features/profile/profileService';
import { createPost, createPostWithMedia, getHomeFeed, getProfilePosts, getPostById, togglePostLike } from './src/features/posts/postService';
import type { CreovaFeedPost } from './src/features/posts/postService';
import { supabase } from './src/lib/supabase';
import {
  SafeAreaView,
  ScrollView,
  Image,
  StatusBar,
  StyleSheet,
  TextInput,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Switch,
} from 'react-native';

type Tab = 'Home' | 'Discover' | 'Create' | 'Inbox' | 'Profile';

const COLORS = {
  background: '#090D18',
  surface: '#111A2B',
  surfaceRaised: '#17243A',
  border: '#263650',
  text: '#F5F7FF',
  muted: '#9AAAC4',
  blue: '#3985FF',
  violet: '#9061F9',
  accentSoft: '#172D55',
};

const TABS: { key: Tab; symbol: string; label: string }[] = [
  { key: 'Home', symbol: '⌂', label: 'Home' },
  { key: 'Discover', symbol: '⌕', label: 'Explore' },
  { key: 'Create', symbol: '+', label: 'Create' },
  { key: 'Inbox', symbol: '✉', label: 'Inbox' },
  { key: 'Profile', symbol: '◉', label: 'Profile' },
];

function Brand() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
      <View>
        <Text style={styles.brandName}>CREOVA</Text>
        <Text style={styles.brandTagline}>CREATE. CONNECT. EVOLVE.</Text>
      </View>
    </View>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✦</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

function HomeScreen() {
  const [posts, setPosts] = useState<CreovaFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busyPost, setBusyPost] = useState('');

  async function loadFeed() {
    setLoading(true);
    setMessage('');
    try {
      setPosts(await getHomeFeed());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load your feed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
  }, []);

  async function likePost(postId: string) {
    setBusyPost(postId);
    try {
      const liked = await togglePostLike(postId);
      setPosts(items => items.map(item => item.id === postId
        ? { ...item, likedByMe: liked, likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)) }
        : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update your like.');
    } finally {
      setBusyPost('');
    }
  }

  return (
    <View style={styles.screenContent}>
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.eyebrow}>YOUR WORLD</Text>
          <Text style={styles.heading}>Home</Text>
        </View>
        <TouchableOpacity onPress={loadFeed} style={styles.refreshButton}>
          <Text style={styles.refreshText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeGlow} />
        <Text style={styles.welcomeEyebrow}>A NEW WAY TO BE SOCIAL</Text>
        <Text style={styles.welcomeTitle}>Your world.{ '\n' }Your evolution.</Text>
        <Text style={styles.welcomeCopy}>Connect with people, discover ideas, share what you create, and show how it evolves.</Text>
        <View style={styles.pillarRow}>
          <View style={styles.pillar}><Text style={styles.pillarNumber}>01</Text><Text style={styles.pillarLabel}>CONNECT</Text></View>
          <View style={styles.pillarDivider} />
          <View style={styles.pillar}><Text style={styles.pillarNumber}>02</Text><Text style={styles.pillarLabel}>CREATE</Text></View>
          <View style={styles.pillarDivider} />
          <View style={styles.pillar}><Text style={styles.pillarNumber}>03</Text><Text style={styles.pillarLabel}>EVOLVE</Text></View>
        </View>
      </View>
      <View style={styles.feedHeading}>
        <Text style={styles.subheading}>Your feed</Text>
        <Text style={styles.mutedSmall}>FOLLOWING</Text>
      </View>
      {!!message && <Text style={styles.notice}>{message}</Text>}
      {loading && <EmptyState title="Loading your feed" description="Finding the latest posts from your CREOVA network." />}
      {!loading && posts.length === 0 && <EmptyState title="Your feed starts here" description="Follow people or publish your first post. Their updates will appear here." />}
      {posts.map(post => (
        <View key={post.id} style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.resultAvatar}>
              <Text style={styles.resultAvatarText}>{(post.author?.display_name || post.author?.username || 'C').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.postAuthor}>
              <Text style={styles.resultName}>{post.author?.display_name || 'CREOVA member'}</Text>
              <Text style={styles.resultHandle}>@{post.author?.username || 'member'} · {post.post_type.toUpperCase()} · {new Date(post.created_at).toLocaleDateString()}</Text>
            </View>
          </View>
          {post.media?.map(media => <Image key={media.id} source={{ uri: media.signedUrl }} style={styles.feedImage} resizeMode="cover" />)}
          {!!post.caption && <Text style={styles.postCaption}>{post.caption}</Text>}
          <View style={styles.postActions}>
            <TouchableOpacity disabled={busyPost === post.id} onPress={() => likePost(post.id)} style={styles.postAction}>
              <Text style={[styles.postActionText, post.likedByMe && styles.postLiked]}>{post.likedByMe ? '♥' : '♡'} {post.likeCount}</Text>
            </TouchableOpacity>
            <View style={styles.postAction}><Text style={styles.postActionText}>▢ {post.commentCount}</Text></View>
          </View>
        </View>
      ))}
    </View>
  );
}

function DiscoverScreen({ onOpenProfile }: { onOpenProfile: (username: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchProfiles>>>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function search() {
    setBusy(true); setMessage('');
    try { setResults(await searchProfiles(query)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Search failed.'); }
    finally { setBusy(false); }
  }
  async function follow(id: string) {
    try {
      const result = await followProfile(id);
      setResults(items => items.map(item => item.id === id ? { ...item, followState: result } as typeof item : item));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Follow action failed.'); }
  }
  return <View style={styles.screenContent}>
    <Text style={styles.eyebrow}>FIND YOUR PEOPLE</Text>
    <Text style={styles.heading}>Explore</Text>
    <View style={styles.searchRow}>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search usernames" placeholderTextColor="#71819C" style={styles.searchInput} autoCapitalize="none" autoCorrect={false} onSubmitEditing={search} />
      <TouchableOpacity onPress={search} disabled={busy} style={styles.searchButton}><Text style={styles.searchButtonText}>{busy ? '…' : 'Search'}</Text></TouchableOpacity>
    </View>
    {!!message && <Text style={styles.notice}>{message}</Text>}
    {results.map(item => <View key={item.id} style={styles.resultRow}>
      <TouchableOpacity onPress={() => onOpenProfile(item.username)} style={styles.resultAvatar}>
        {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : <Text style={styles.resultAvatarText}>{(item.display_name || item.username).slice(0,1).toUpperCase()}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onOpenProfile(item.username)} style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.display_name}</Text>
        <Text style={styles.resultHandle}>@{item.username}{item.is_private ? ' · Private' : ''}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => follow(item.id)} style={styles.followButton}><Text style={styles.followButtonText}>{(item as typeof item & {followState?: string}).followState === 'requested' ? 'Requested' : (item as typeof item & {followState?: string}).followState === 'following' ? 'Following' : 'Follow'}</Text></TouchableOpacity>
    </View>)}
    {query.trim().length < 2 && <EmptyState title="Discover something new" description="Search for CREOVA members by username. More discovery feeds and trending topics will follow." />}
    {query.trim().length >= 2 && !busy && results.length === 0 && <EmptyState title="No members found" description="Try another username." />}
  </View>;
}


function PublicProfileScreen({ username, onBack, onOpenProfile }: {
  username: string;
  onBack: () => void;
  onOpenProfile: (username: string) => void;
}) {
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfileByUsername>> | null>(null);
  const [connections, setConnections] = useState<Awaited<ReturnType<typeof getProfileConnections>>>([]);
  const [connectionType, setConnectionType] = useState<'followers' | 'following' | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function loadProfile() {
    setLoading(true);
    setMessage('');
    try {
      setProfile(await getProfileByUsername(username));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load this profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setConnectionType(null);
    setConnections([]);
    loadProfile();
  }, [username]);

  async function toggleFollow() {
    if (!profile) return;
    setBusy(true);
    setMessage('');
    try {
      if (profile.follow_state === 'accepted' || profile.follow_state === 'pending') {
        await unfollowProfile(profile.id);
        setProfile({ ...profile, follow_state: 'not_following' });
      } else {
        const result = await followProfile(profile.id);
        setProfile({ ...profile, follow_state: result === 'requested' ? 'pending' : 'accepted' });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update follow status.');
    } finally {
      setBusy(false);
    }
  }

  async function showConnections(type: 'followers' | 'following') {
    if (!profile) return;
    setBusy(true);
    setMessage('');
    try {
      setConnections(await getProfileConnections(profile.id, type));
      setConnectionType(type);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load this list.');
    } finally {
      setBusy(false);
    }
  }

  if (connectionType) {
    return <View style={styles.screenContent}>
      <TouchableOpacity onPress={() => setConnectionType(null)} style={styles.signOutButton}>
        <Text style={styles.signOutText}>‹ Back to @{username}</Text>
      </TouchableOpacity>
      <Text style={styles.eyebrow}>CREOVA NETWORK</Text>
      <Text style={styles.heading}>{connectionType === 'followers' ? 'Followers' : 'Following'}</Text>
      {!!message && <Text style={styles.notice}>{message}</Text>}
      {connections.map(person => <TouchableOpacity key={person.id} onPress={() => onOpenProfile(person.username)} style={styles.resultRow}>
        <View style={styles.resultAvatar}>
          {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : <Text style={styles.resultAvatarText}>{(person.display_name || person.username).slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultName}>{person.display_name}</Text>
          <Text style={styles.resultHandle}>@{person.username}</Text>
        </View>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>)}
      {!busy && connections.length === 0 && <EmptyState title="No connections yet" description="This list will fill as people connect on CREOVA." />}
    </View>;
  }

  return <View style={styles.screenContent}>
    <TouchableOpacity onPress={onBack} style={styles.signOutButton}>
      <Text style={styles.signOutText}>‹ Back to Explore</Text>
    </TouchableOpacity>
    <Text style={styles.eyebrow}>CREOVA MEMBER</Text>
    <Text style={styles.heading}>Profile</Text>
    {loading && <EmptyState title="Loading profile" description="Getting this member's CREOVA identity." />}
    {!loading && profile && <View style={styles.profileCard}>
      {profile.avatar_url
        ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        : <View style={styles.avatar}><Text style={styles.avatarText}>{(profile.display_name || profile.username).slice(0, 1).toUpperCase()}</Text></View>}
      <Text style={styles.profileName}>{profile.display_name}</Text>
      <Text style={styles.profileHandle}>@{profile.username}{profile.is_private ? ' · PRIVATE' : ''}</Text>
      <View style={styles.profileStats}>
        <TouchableOpacity onPress={() => showConnections('followers')} style={styles.profileStat}>
          <Text style={styles.profileStatNumber}>{profile.followers}</Text><Text style={styles.profileStatLabel}>FOLLOWERS</Text>
        </TouchableOpacity>
        <View style={styles.profileStatDivider} />
        <TouchableOpacity onPress={() => showConnections('following')} style={styles.profileStat}>
          <Text style={styles.profileStatNumber}>{profile.following}</Text><Text style={styles.profileStatLabel}>FOLLOWING</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.profileCopy}>{profile.bio || 'This member has not added a bio yet.'}</Text>
      <TouchableOpacity disabled={busy} onPress={toggleFollow} style={styles.searchButton}>
        <Text style={styles.searchButtonText}>{busy ? 'Please wait…' : profile.follow_state === 'accepted' ? 'Following · Unfollow' : profile.follow_state === 'pending' ? 'Requested · Cancel' : profile.follow_state === 'rejected' ? 'Follow again' : 'Follow'}</Text>
      </TouchableOpacity>
      {!!message && <Text style={styles.notice}>{message}</Text>}
      {profile.is_private && profile.follow_state !== 'accepted' && <Text style={styles.privacyHint}>Follow this private account to see its posts and full activity.</Text>}
    </View>}
    {!loading && !profile && <EmptyState title="Profile unavailable" description={message || 'This CREOVA profile could not be found.'} />}
  </View>;
}

function CreateScreen() {
  const [caption, setCaption] = useState('');
  const [postType, setPostType] = useState<'post' | 'anchor' | 'iteration'>('post');
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [selectedMedia, setSelectedMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');

  async function chooseImage() {
    setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mediaType = asset.type === 'video' ? 'video' : 'image';
        const mimeType = asset.mimeType ?? (mediaType === 'image' ? 'image/jpeg' : '');
        const allowed = mediaType === 'image'
          ? ['image/jpeg', 'image/png', 'image/webp']
          : ['video/mp4', 'video/quicktime', 'video/webm'];
        const maxBytes = mediaType === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
        if (!allowed.includes(mimeType)) {
          setNotice(mediaType === 'image' ? 'Use a JPEG, PNG, or WebP image.' : 'Use an MP4, MOV, or WebM video.');
          return;
        }
        if (asset.fileSize && asset.fileSize > maxBytes) {
          setNotice(mediaType === 'image' ? 'Choose an image smaller than 10 MB.' : 'Choose a video smaller than 50 MB.');
          return;
        }
        if (mediaType === 'video' && asset.duration && asset.duration > 60_000) {
          setNotice('Choose a video that is 60 seconds or shorter.');
          return;
        }
        setSelectedMedia({ ...asset, mimeType });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not open your photo library.');
    }
  }

  async function publish() {
    if (!caption.trim() && !selectedMedia) {
      setNotice('Write a caption or choose an image first.');
      return;
    }
    setPublishing(true);
    setNotice('');
    try {
      if (selectedMedia) {
        await createPostWithMedia({
          caption,
          postType,
          visibility,
          media: {
            uri: selectedMedia.uri,
            mimeType: selectedMedia.mimeType ?? 'image/jpeg',
            fileSize: selectedMedia.fileSize ?? null,
            width: selectedMedia.width,
            height: selectedMedia.height,
            mediaType: selectedMedia.type === 'video' ? 'video' : 'image',
            durationSeconds: selectedMedia.type === 'video' && selectedMedia.duration
              ? selectedMedia.duration / 1000
              : null,
          },
        });
      } else {
        await createPost({ caption, postType, visibility });
      }
      setCaption('');
      setSelectedMedia(null);
      setNotice('Published. Your post is now in your CREOVA feed.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not publish your post.');
    } finally {
      setPublishing(false);
    }
  }

  return <View style={styles.screenContent}>
    <Text style={styles.eyebrow}>MAKE SOMETHING THAT MOVES</Text>
    <Text style={styles.heading}>Create</Text>
    <View style={styles.composerCard}>
      <Text style={styles.composerTitle}>Share an update</Text>
      <Text style={styles.composerHint}>Share your words and photos with your CREOVA community.</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        multiline
        maxLength={2200}
        placeholder="What are you creating, learning, or evolving?"
        placeholderTextColor="#71819C"
        style={styles.composerInput}
        textAlignVertical="top"
      />
      <Text style={styles.composerCount}>{caption.length}/2200</Text>
      <TouchableOpacity onPress={chooseImage} disabled={publishing} style={styles.imagePickButton}>
        <Text style={styles.imagePickButtonText}>{selectedMedia ? 'Change selected media' : '＋ Add photo or video'}</Text>
      </TouchableOpacity>
      {selectedMedia && <View style={styles.imagePreviewWrap}>
        {selectedMedia.type === 'video'
          ? <View style={[styles.imagePreview, styles.videoPreview]}><Text style={styles.videoPreviewIcon}>▶</Text><Text style={styles.videoPreviewText}>VIDEO · {Math.round((selectedMedia.duration ?? 0) / 1000)} SEC</Text></View>
          : <Image source={{ uri: selectedMedia.uri }} style={styles.imagePreview} resizeMode="cover" />}
        <TouchableOpacity onPress={() => setSelectedMedia(null)} style={styles.removeImageButton}>
          <Text style={styles.removeImageText}>Remove media</Text>
        </TouchableOpacity>
      </View>}
      <Text style={styles.editLabel}>POST FORMAT</Text>
      <View style={styles.postTypeRow}>
        {(['post', 'anchor', 'iteration'] as const).map(type => (
          <TouchableOpacity key={type} onPress={() => setPostType(type)} style={[styles.postTypeChip, postType === type && styles.postTypeChipActive]}>
            <Text style={[styles.postTypeText, postType === type && styles.postTypeTextActive]}>{type.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.editLabel}>WHO CAN SEE THIS?</Text>
      <View style={styles.postTypeRow}>
        {(['public', 'followers'] as const).map(value => (
          <TouchableOpacity key={value} onPress={() => setVisibility(value)} style={[styles.postTypeChip, visibility === value && styles.postTypeChipActive]}>
            <Text style={[styles.postTypeText, visibility === value && styles.postTypeTextActive]}>{value === 'public' ? 'PUBLIC' : 'FOLLOWERS'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity disabled={publishing || (!caption.trim() && !selectedMedia)} onPress={publish} style={[styles.publishButton, (publishing || (!caption.trim() && !selectedMedia)) && styles.publishButtonDisabled]}>
        <Text style={styles.publishButtonText}>{publishing ? 'Publishing…' : 'Publish post'}</Text>
      </TouchableOpacity>
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
    </View>
    <View style={styles.createOption}><Text style={styles.optionSymbol}>▶</Text><View style={styles.optionText}><Text style={styles.optionTitle}>Short video</Text><Text style={styles.optionDescription}>Video publishing and processing will follow the photo pipeline.</Text></View><Text style={styles.optionArrow}>›</Text></View>
  </View>;
}
function InboxScreen() {
  return <View style={styles.screenContent}>
    <Text style={styles.eyebrow}>STAY IN THE LOOP</Text>
    <Text style={styles.heading}>Inbox</Text>
    <EmptyState title="Your conversations will appear here" description="Private and group messaging will be connected after the conversation service, privacy rules, and real-time delivery are implemented." />
  </View>;
}

function ProfileScreen() {
  const [profile, setProfile] = useState<CreovaProfile | null>(null);
  const [profileStats, setProfileStats] = useState({ followers: 0, following: 0 });
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [ownConnections, setOwnConnections] = useState<Awaited<ReturnType<typeof getProfileConnections>>>([]);
  const [ownConnectionType, setOwnConnectionType] = useState<'followers' | 'following' | null>(null);
  const [loadingConnections, setLoadingConnections] = useState(false);

  async function openOwnConnections(type: 'followers' | 'following') {
    if (!profile) return;
    setLoadingConnections(true);
    setNotice('');
    try {
      setOwnConnections(await getProfileConnections(profile.id, type));
      setOwnConnectionType(type);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not load your connections.');
    } finally {
      setLoadingConnections(false);
    }
  }

  useEffect(() => {
    let active = true;
    getMyProfile().then(value => {
      if (!active) return;
      setProfile(value);
      setDisplayName(value.display_name);
      setBio(value.bio);
      setIsPrivate(value.is_private);
      getMyProfileStats().then(setProfileStats).catch(statsError => {
        if (active) setError(statsError instanceof Error ? statsError.message : 'Could not load profile stats.');
      });
    }).catch(e => {
      if (active) setError(e instanceof Error ? e.message : 'Could not load your profile.');
    });
    return () => { active = false; };
  }, []);

  async function chooseAvatar() {
    setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType;
      if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        setNotice('Choose a JPEG, PNG, or WebP image.');
        return;
      }
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        setNotice('Choose an image smaller than 5 MB.');
        return;
      }
      setUploadingAvatar(true);
      const updated = await uploadMyAvatar(asset.uri, mimeType as 'image/jpeg' | 'image/png' | 'image/webp');
      setProfile(updated);
      setNotice('Your profile photo has been updated.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not upload your profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile() {
    if (!displayName.trim()) {
      setNotice('Your display name cannot be empty.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const updated = await updateMyProfile({
        display_name: displayName,
        bio,
        is_private: isPrivate,
      });
      setProfile(updated);
      setEditing(false);
      setNotice('Your profile has been updated.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
  }

  return <View style={styles.screenContent}>
    <Text style={styles.eyebrow}>YOUR CREOVA IDENTITY</Text>
    <Text style={styles.heading}>Profile</Text>
    {profile ? <View style={styles.profileCard}>
      {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <View style={styles.avatar}><Text style={styles.avatarText}>{(profile.display_name || profile.username).slice(0,1).toUpperCase()}</Text></View>}
      <TouchableOpacity disabled={uploadingAvatar} onPress={chooseAvatar} style={styles.avatarChangeButton}><Text style={styles.avatarChangeText}>{uploadingAvatar ? 'Uploading photo…' : 'Change profile photo'}</Text></TouchableOpacity>
      <Text style={styles.profileName}>{profile.display_name}</Text>
      <Text style={styles.profileHandle}>@{profile.username}</Text>
      <View style={styles.profileStats}>
        <TouchableOpacity onPress={() => openOwnConnections('followers')} style={styles.profileStat}><Text style={styles.profileStatNumber}>{profileStats.followers}</Text><Text style={styles.profileStatLabel}>FOLLOWERS</Text></TouchableOpacity>
        <View style={styles.profileStatDivider} />
        <TouchableOpacity onPress={() => openOwnConnections('following')} style={styles.profileStat}><Text style={styles.profileStatNumber}>{profileStats.following}</Text><Text style={styles.profileStatLabel}>FOLLOWING</Text></TouchableOpacity>
      </View>
      {ownConnectionType && <View style={{ width: '100%', marginTop: 14 }}>
        <TouchableOpacity onPress={() => setOwnConnectionType(null)} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Close {ownConnectionType}</Text>
        </TouchableOpacity>
        <Text style={styles.editLabel}>{ownConnectionType.toUpperCase()}</Text>
        {ownConnections.map(person => <View key={person.id} style={styles.resultRow}>
          <View style={styles.resultAvatar}>
            {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : <Text style={styles.resultAvatarText}>{(person.display_name || person.username).slice(0, 1).toUpperCase()}</Text>}
          </View>
          <View style={styles.resultInfo}><Text style={styles.resultName}>{person.display_name}</Text><Text style={styles.resultHandle}>@{person.username}</Text></View>
        </View>)}
        {!loadingConnections && ownConnections.length === 0 && <Text style={styles.privacyHint}>No {ownConnectionType} yet.</Text>}
      </View>}
      <Text style={styles.profileCopy}>{profile.bio || 'Add a bio to tell your story.'}</Text>
      <Text style={styles.profilePrivacy}>{profile.is_private ? 'PRIVATE ACCOUNT' : 'PUBLIC ACCOUNT'}</Text>
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      {editing ? <View style={styles.profileEditor}>
        <Text style={styles.editLabel}>DISPLAY NAME</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} maxLength={60} style={styles.editInput} placeholder="Your display name" placeholderTextColor="#71819C" />
        <Text style={styles.editLabel}>BIO</Text>
        <TextInput value={bio} onChangeText={setBio} maxLength={160} multiline style={[styles.editInput, styles.bioInput]} placeholder="Tell people about yourself" placeholderTextColor="#71819C" />
        <View style={styles.privacyRow}>
          <View style={styles.privacyText}>
            <Text style={styles.editLabel}>PRIVATE ACCOUNT</Text>
            <Text style={styles.privacyHint}>Only approved followers can follow you.</Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: '#34445F', true: '#3985FF' }} thumbColor="#FFFFFF" />
        </View>
        <TouchableOpacity disabled={saving} onPress={saveProfile} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          setDisplayName(profile.display_name);
          setBio(profile.bio);
          setIsPrivate(profile.is_private);
          setEditing(false);
          setNotice('');
        }} style={styles.signOutButton}><Text style={styles.signOutText}>Cancel</Text></TouchableOpacity>
      </View> : <TouchableOpacity onPress={() => { setNotice(''); setEditing(true); }} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Edit profile</Text>
      </TouchableOpacity>}
      <TouchableOpacity onPress={signOut} style={styles.signOutButton}><Text style={styles.signOutText}>Sign out</Text></TouchableOpacity>
    </View> : <EmptyState title={error || 'Loading your profile…'} description={error ? 'Check your connection and try again.' : 'Your account profile is being loaded from CREOVA.'} />}
    <EmptyState title="Your evolution starts here" description="Your posts, Anchors, Iterations, skills, and proof of execution will come together on your profile." />
  </View>;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  const openProfile = (username: string) => {
    setSelectedProfileUsername(username);
    setActiveTab('Discover');
  };

  const renderScreen = () => {
    if (selectedProfileUsername) {
      return <PublicProfileScreen
        username={selectedProfileUsername}
        onBack={() => setSelectedProfileUsername(null)}
        onOpenProfile={setSelectedProfileUsername}
      />;
    }
    switch (activeTab) {
      case 'Discover': return <DiscoverScreen onOpenProfile={openProfile} />;
      case 'Create': return <CreateScreen />;
      case 'Inbox': return <InboxScreen />;
      case 'Profile': return <ProfileScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.app}>
        <View style={[styles.topBar, isWide && styles.topBarWide]}>
          <Brand />
          {isWide && <Text style={styles.topBarNote}>THE SOCIAL NETWORK BUILT FOR EVOLUTION</Text>}
          <View style={styles.topBarAction}><Text style={styles.topBarActionText}>✧</Text></View>
        </View>
        <View style={[styles.body, isWide && styles.bodyWide]}>
          {isWide && <View style={styles.sideNav}>
            {TABS.map(tab => <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.sideNavItem, activeTab === tab.key && styles.sideNavItemActive]}>
              <Text style={[styles.sideNavSymbol, activeTab === tab.key && styles.activeText]}>{tab.symbol}</Text>
              <Text style={[styles.sideNavLabel, activeTab === tab.key && styles.activeText]}>{tab.label}</Text>
            </TouchableOpacity>)}
          </View>}
          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainScrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.contentMax, isWide && styles.contentMaxWide]}>{renderScreen()}</View>
          </ScrollView>
        </View>
        {!isWide && <View style={styles.bottomNav}>
          {TABS.map(tab => <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.bottomNavItem} accessibilityRole="button" accessibilityLabel={tab.label} accessibilityState={{ selected: activeTab === tab.key }}>
            <Text style={[styles.bottomNavSymbol, activeTab === tab.key && styles.activeText, tab.key === 'Create' && styles.createSymbol]}>{tab.symbol}</Text>
            <Text style={[styles.bottomNavLabel, activeTab === tab.key && styles.activeText]}>{tab.label}</Text>
          </TouchableOpacity>)}
        </View>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  app: { flex: 1, backgroundColor: COLORS.background },
  topBar: { height: 72, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarWide: { paddingHorizontal: 36 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: '#355B9C', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#8DB8FF', fontSize: 24, fontWeight: '800' },
  brandName: { color: COLORS.text, fontSize: 17, fontWeight: '900', letterSpacing: 2.6 },
  brandTagline: { color: COLORS.muted, fontSize: 8, letterSpacing: 1.4, marginTop: 3 },
  topBarNote: { color: COLORS.muted, fontSize: 10, letterSpacing: 1.8 },
  topBarAction: { width: 38, height: 38, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  topBarActionText: { color: '#A7C6FF', fontSize: 21 },
  body: { flex: 1 },
  bodyWide: { flexDirection: 'row' },
  sideNav: { width: 220, borderRightWidth: 1, borderRightColor: COLORS.border, paddingHorizontal: 16, paddingTop: 28, gap: 8 },
  sideNavItem: { height: 48, borderRadius: 13, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 15 },
  sideNavItemActive: { backgroundColor: COLORS.accentSoft },
  sideNavSymbol: { color: COLORS.muted, fontSize: 22, width: 23, textAlign: 'center' },
  sideNavLabel: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  activeText: { color: '#8DB8FF' },
  mainScroll: { flex: 1 },
  mainScrollContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36 },
  contentMax: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  contentMaxWide: { maxWidth: 760 },
  screenContent: { gap: 18 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#83AFFF', fontSize: 10, fontWeight: '800', letterSpacing: 2.1, marginBottom: 7 },
  heading: { color: COLORS.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.7 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.surface },
  statusDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#75D8B1' },
  liveText: { color: '#B7C7E0', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  welcomeCard: { backgroundColor: '#111F38', borderWidth: 1, borderColor: '#2B4775', borderRadius: 24, padding: 23, overflow: 'hidden', gap: 12 },
  welcomeGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 110, backgroundColor: '#253F80', opacity: 0.35, top: -115, right: -50 },
  welcomeEyebrow: { color: '#A8C7FF', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  welcomeTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1 },
  welcomeCopy: { color: '#B6C5DE', fontSize: 13, lineHeight: 20, maxWidth: 430 },
  pillarRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 18 },
  pillar: { gap: 4 },
  pillarNumber: { color: '#91B8FF', fontSize: 15, fontWeight: '900' },
  pillarLabel: { color: '#C5D4EB', fontSize: 8, letterSpacing: 1.2, fontWeight: '800' },
  pillarDivider: { width: 1, height: 28, backgroundColor: '#3A5278' },
  feedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  subheading: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  mutedSmall: { color: COLORS.muted, fontSize: 8, letterSpacing: 1.2, fontWeight: '700' },
  emptyCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 23, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  emptyIconText: { color: '#9ABEFF', fontSize: 22 },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', maxWidth: 410 },
  createOption: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: COLORS.surface },
  optionSymbol: { color: '#9ABEFF', fontSize: 25, width: 32, textAlign: 'center' },
  optionText: { flex: 1, gap: 4 },
  optionTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  optionDescription: { color: COLORS.muted, fontSize: 11 },
  optionArrow: { color: COLORS.muted, fontSize: 25 },
  notice: { color: COLORS.muted, fontSize: 11, lineHeight: 18, paddingHorizontal: 3 },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border },
  refreshText: { color: '#A7C6FF', fontSize: 11, fontWeight: '800' },
  postCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 15, gap: 14 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  postAuthor: { flex: 1, gap: 4 },
  postCaption: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  feedImage: { width: '100%', aspectRatio: 1, borderRadius: 13, backgroundColor: '#0B1322' },
  imagePickButton: { minHeight: 43, borderRadius: 11, borderWidth: 1, borderColor: '#355B9C', backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  imagePickButtonText: { color: '#A7C6FF', fontSize: 12, fontWeight: '800' },
  imagePreviewWrap: { gap: 8 },
  imagePreview: { width: '100%', aspectRatio: 1, borderRadius: 13, backgroundColor: '#0B1322' },
  removeImageButton: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 3 },
  removeImageText: { color: '#FF91A9', fontSize: 11, fontWeight: '700' },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 20, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  postAction: { paddingVertical: 3 },
  postActionText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  postLiked: { color: '#FF6B91' },
  composerCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 19, padding: 17, gap: 12 },
  composerTitle: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  composerHint: { color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  composerInput: { minHeight: 145, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#0B1322', color: COLORS.text, padding: 13, fontSize: 13, lineHeight: 20 },
  composerCount: { color: COLORS.muted, fontSize: 9, textAlign: 'right' },
  postTypeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  postTypeChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#0B1322' },
  postTypeChipActive: { borderColor: COLORS.blue, backgroundColor: COLORS.accentSoft },
  postTypeText: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  postTypeTextActive: { color: '#A7C6FF' },
  publishButton: { minHeight: 46, borderRadius: 12, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  publishButtonDisabled: { opacity: 0.45 },
  publishButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  profileCard: { alignItems: 'center', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 9 },
  avatar: { width: 76, height: 76, borderRadius: 28, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: '#4268A4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#A7C6FF', fontSize: 36, fontWeight: '900' },
  avatarChangeButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: '#355B9C' },
  avatarChangeText: { color: '#A7C6FF', fontSize: 10, fontWeight: '800' },
  profileName: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  profileCopy: { color: COLORS.muted, fontSize: 12, lineHeight: 19, textAlign: 'center', maxWidth: 370 },
  bottomNav: { height: 66, paddingBottom: 5, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  bottomNavSymbol: { color: COLORS.muted, fontSize: 21, height: 25 },
  createSymbol: { color: '#FFFFFF', backgroundColor: COLORS.blue, borderRadius: 10, overflow: 'hidden', width: 30, height: 28, lineHeight: 28, textAlign: 'center', fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 9 },
  searchInput: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, paddingHorizontal: 14, fontSize: 13 },
  searchButton: { minWidth: 82, borderRadius: 12, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  searchButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 15, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  resultAvatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  resultAvatarText: { color: '#A7C6FF', fontSize: 17, fontWeight: '900' },
  resultInfo: { flex: 1, gap: 4 },
  resultName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  resultHandle: { color: COLORS.muted, fontSize: 10 },
  followButton: { backgroundColor: COLORS.accentSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  followButtonText: { color: '#A7C6FF', fontSize: 10, fontWeight: '800' },
  profileHandle: { color: '#A7C6FF', fontSize: 12, fontWeight: '700' },
  profileStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26, paddingVertical: 9 },
  profileStat: { alignItems: 'center', gap: 3 },
  profileStatNumber: { color: COLORS.text, fontSize: 17, fontWeight: '900' },
  profileStatLabel: { color: COLORS.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  profileStatDivider: { width: 1, height: 26, backgroundColor: COLORS.border },
  profilePrivacy: { color: COLORS.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: '800' },
  profileEditor: { width: '100%', gap: 10, marginTop: 8 },
  editLabel: { color: '#AFC5E8', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  editInput: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#0B1322', color: COLORS.text, paddingHorizontal: 12, fontSize: 13 },
  bioInput: { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  privacyText: { flex: 1, gap: 5 },
  privacyHint: { color: COLORS.muted, fontSize: 10 },
  signOutButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  signOutText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  bottomNavLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '600' }
});


export default function App() {
  return <AuthGate><MainApp /></AuthGate>;
}
