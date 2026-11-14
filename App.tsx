import React, { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import VideoTrim, { getFrameAt, showEditor } from 'react-native-video-trim';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AuthGate } from './src/features/auth/AuthGate';
import { getMyProfile, getMyProfileStats, searchProfiles, followProfile, unfollowProfile, getProfileByUsername, getProfileConnections, updateMyProfile, uploadMyAvatar, respondToFollowRequest } from './src/features/profile/profileService';
import type { CreovaProfile } from './src/features/profile/profileService';
import { createPost, createPostWithMedia, cancelActivePostMediaUpload, getHomeFeed, getReelsFeed, getProfilePosts, getPostById, togglePostLike, getPostComments, createPostComment, updatePostComment, deletePostComment, setPostCommentReaction } from './src/features/posts/postService';
import type { CreovaFeedPost, CreovaPostComment, CreovaCommentReaction } from './src/features/posts/postService';
import { supabase } from './src/lib/supabase';
import { getMyNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, subscribeToMyNotifications, getMyNotificationPreferences, saveMyNotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from './src/features/notifications/notificationService';
import type { CreovaNotification, CreovaNotificationPreferences } from './src/features/notifications/notificationService';
import { MessagingInbox } from './src/features/messaging/MessagingInbox';
import { StoriesSection } from './src/features/stories/StoriesSection';
import { StoryHighlightsSection } from './src/features/stories/StoryHighlightsSection';
import { getThisDevicePushStatus, registerThisDeviceForPushNotifications, disableThisDevicePushNotifications, addPushNotificationResponseListener, getInitialPushNotificationResponse } from './src/features/notifications/pushNotificationService';
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
  Share,
  Modal,
} from 'react-native';

type Tab = 'Home' | 'Reels' | 'Discover' | 'Create' | 'Inbox' | 'Profile';

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
  { key: 'Reels', symbol: '▶', label: 'Reels' },
  { key: 'Discover', symbol: '⌕', label: 'Explore' },
  { key: 'Create', symbol: '+', label: 'Create' },
  { key: 'Inbox', symbol: '✉', label: 'Messages' },
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
      <StoriesSection />
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

function ReelVideo({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    if (active) instance.play();
  });
  useEffect(() => { if (active) player.play(); else player.pause(); }, [active, player]);
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />;
}

function ReelsScreen({ onOpenPost }: { onOpenPost: (postId: string) => void }) {
  const [reels, setReels] = useState<CreovaFeedPost[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyPost, setBusyPost] = useState('');
  const [message, setMessage] = useState('');
  const { height } = useWindowDimensions();
  const reelHeight = Math.max(520, height - 176);
  async function loadReels() {
    setLoading(true); setMessage('');
    try { setReels(await getReelsFeed()); setActiveIndex(0); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load Reels.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadReels(); }, []);
  async function likeReel(reel: CreovaFeedPost) {
    if (busyPost) return;
    setBusyPost(reel.id); setMessage('');
    try {
      const liked = await togglePostLike(reel.id);
      setReels(items => items.map(item => item.id === reel.id ? { ...item, likedByMe: liked, likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)) } : item));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update your like.'); }
    finally { setBusyPost(''); }
  }
  async function shareReel(reel: CreovaFeedPost) {
    try { await Share.share({ message: 'Watch this CREOVA Reel by @' + (reel.author?.username ?? 'creator') + ': ' + reel.caption }); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open sharing.'); }
  }
  return <View style={styles.screenContent}>
    <View style={styles.sectionHeading}>
      <View><Text style={styles.eyebrow}>SHORT VIDEOS</Text><Text style={styles.heading}>Reels</Text></View>
      <TouchableOpacity onPress={() => void loadReels()} style={styles.refreshButton}><Text style={styles.refreshText}>↻ Refresh</Text></TouchableOpacity>
    </View>
    {!!message && <Text style={styles.notice}>{message}</Text>}
    {loading && <EmptyState title="Loading Reels" description="Finding videos shared by the CREOVA community." />}
    {!loading && reels.length === 0 && <EmptyState title="Your Reels feed starts here" description="Publish a video from Create, or follow creators whose videos you want to see." />}
    {!loading && reels.length > 0 && <ScrollView style={{ height: reelHeight, borderRadius: 18, overflow: 'hidden', backgroundColor: '#05070D' }} pagingEnabled snapToInterval={reelHeight} decelerationRate="fast" showsVerticalScrollIndicator={false} onMomentumScrollEnd={event => setActiveIndex(Math.min(reels.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.y / reelHeight))))}>
      {reels.map((reel, index) => {
        const video = reel.media.find(item => item.mediaType === 'video');
        if (!video) return null;
        return <View key={reel.id} style={{ height: reelHeight, backgroundColor: '#05070D', justifyContent: 'center' }}>
          {index === activeIndex
            ? <ReelVideo uri={video.signedUrl} active />
            : video.coverSignedUrl
              ? <Image source={{ uri: video.coverSignedUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              : <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#101827' }}><Text style={{ color: '#FFFFFF', fontSize: 34 }}>▶</Text></View>}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 240, backgroundColor: 'rgba(0,0,0,0.38)' }} />
          <View style={{ position: 'absolute', left: 16, right: 76, bottom: 24 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 14, marginBottom: 7 }}>@{reel.author?.username ?? 'creator'}</Text>
            {!!reel.caption && <Text numberOfLines={4} style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 19 }}>{reel.caption}</Text>}
            <Text style={{ color: '#D2D9E7', fontSize: 10, marginTop: 8 }}>CREOVA · {new Date(reel.created_at).toLocaleDateString()}</Text>
          </View>
          <View style={{ position: 'absolute', right: 12, bottom: 26, alignItems: 'center', gap: 19 }}>
            <TouchableOpacity disabled={busyPost === reel.id} onPress={() => void likeReel(reel)} style={{ alignItems: 'center' }}><Text style={{ color: reel.likedByMe ? '#FF5577' : '#FFFFFF', fontSize: 30 }}>{reel.likedByMe ? '♥' : '♡'}</Text><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{reel.likeCount}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => onOpenPost(reel.id)} style={{ alignItems: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 27 }}>▢</Text><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{reel.commentCount}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => void shareReel(reel)} style={{ alignItems: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 25 }}>↗</Text><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>Share</Text></TouchableOpacity>
          </View>
        </View>;
      })}
    </ScrollView>}
  </View>;
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


function PostGrid({ posts, loading, onOpenPost }: {
  posts: Awaited<ReturnType<typeof getProfilePosts>>;
  loading: boolean;
  onOpenPost: (postId: string) => void;
}) {
  if (loading) return <EmptyState title="Loading posts" description="Preparing this creator's posts." />;
  if (!posts.length) return <EmptyState title="No posts yet" description="Published photos, videos, and updates will appear here." />;
  return <View style={styles.postGrid}>
    {posts.map(post => {
      const firstMedia = post.media[0];
      return <TouchableOpacity
        key={post.id}
        onPress={() => onOpenPost(post.id)}
        style={styles.gridTile}
        accessibilityRole="button"
        accessibilityLabel={`Open post by ${post.author?.username ?? 'creator'}`}
      >
        {firstMedia?.mediaType === 'image'
          ? <Image source={{ uri: firstMedia.signedUrl }} style={styles.gridImage} resizeMode="cover" />
          : firstMedia?.mediaType === 'video'
            ? <View style={[styles.gridImage, styles.gridVideo]}>
                <Text style={styles.gridVideoIcon}>▶</Text>
                <Text style={styles.gridVideoDuration}>{firstMedia.durationSeconds ? `${Math.round(firstMedia.durationSeconds)}s` : 'VIDEO'}</Text>
              </View>
            : <View style={[styles.gridImage, styles.gridTextPost]}>
                <Text style={styles.gridTextPreview} numberOfLines={5}>{post.caption || 'CREOVA post'}</Text>
              </View>}
        {post.media.length > 1 && <View style={styles.gridMultiple}><Text style={styles.gridMultipleText}>▧</Text></View>}
      </TouchableOpacity>;
    })}
  </View>;
}

function VideoPostPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => { instance.loop = false; });
  return <VideoView
    player={player}
    style={styles.detailVideo}
    contentFit="contain"
    nativeControls
    fullscreenOptions={{ enable: true }}
  />;
}

function PostDetailScreen({ postId, onBack }: { postId: string; onBack: () => void }) {
  const [post, setPost] = useState<Awaited<ReturnType<typeof getPostById>> | null>(null);
  const [comments, setComments] = useState<CreovaPostComment[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<CreovaPostComment | null>(null);
  const [editingComment, setEditingComment] = useState<CreovaPostComment | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);

  async function loadComments() {
    setCommentsLoading(true);
    try {
      const loaded = await getPostComments(postId);
      setComments(loaded);
      setPost(current => current ? { ...current, commentCount: loaded.length } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load comments.');
    } finally {
      setCommentsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setCommentsLoading(true);
    Promise.all([getPostById(postId), getPostComments(postId), supabase ? supabase.auth.getUser() : Promise.resolve({ data: { user: null }, error: null })])
      .then(([loadedPost, loadedComments, auth]) => {
        if (!active) return;
        setPost({ ...loadedPost, commentCount: loadedComments.length });
        setComments(loadedComments);
        setViewerId(auth.data.user?.id ?? null);
      }).catch(error => {
        if (active) setMessage(error instanceof Error ? error.message : 'Could not load this post.');
      }).finally(() => {
        if (active) {
          setLoading(false);
          setCommentsLoading(false);
        }
      });
    return () => { active = false; };
  }, [postId]);

  async function toggleLike() {
    if (!post || likeBusy) return;
    setLikeBusy(true);
    setMessage('');
    try {
      const liked = await togglePostLike(post.id);
      setPost({ ...post, likedByMe: liked, likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update your like.');
    } finally {
      setLikeBusy(false);
    }
  }

  async function submitComment() {
    if (!post || commentBusy) return;
    setCommentBusy(true);
    setMessage('');
    try {
      if (editingComment) {
        await updatePostComment(editingComment.id, commentDraft);
        setEditingComment(null);
      } else {
        await createPostComment(post.id, commentDraft, replyingTo?.id ?? null);
        setReplyingTo(null);
      }
      setCommentDraft('');
      await loadComments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your comment.');
    } finally {
      setCommentBusy(false);
    }
  }

  function beginEdit(comment: CreovaPostComment) {
    setEditingComment(comment);
    setReplyingTo(null);
    setCommentDraft(comment.body);
    setDeleteConfirmId(null);
  }

  function cancelComposer() {
    setEditingComment(null);
    setReplyingTo(null);
    setCommentDraft('');
  }

  async function confirmDelete(commentId: string) {
    if (commentBusy) return;
    setCommentBusy(true);
    setMessage('');
    try {
      await deletePostComment(commentId);
      setDeleteConfirmId(null);
      if (editingComment?.id === commentId) cancelComposer();
      await loadComments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete this comment.');
    } finally {
      setCommentBusy(false);
    }
  }

  async function reactToComment(commentId: string, reaction: CreovaCommentReaction) {
    if (commentBusy) return;
    setCommentBusy(true);
    setMessage('');
    try {
      await setPostCommentReaction(commentId, reaction);
      await loadComments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this reaction.');
    } finally {
      setCommentBusy(false);
    }
  }

  const reactionOptions: { type: CreovaCommentReaction; emoji: string }[] = [
    { type: 'like', emoji: '👍' }, { type: 'love', emoji: '❤️' },
    { type: 'laugh', emoji: '😂' }, { type: 'wow', emoji: '😮' },
    { type: 'sad', emoji: '😢' }, { type: 'angry', emoji: '😡' },
  ];

  function renderComment(comment: CreovaPostComment, isReply = false) {
    const ownComment = comment.user_id === viewerId;
    const counts = reactionOptions.map(option => ({
      ...option,
      count: (comment.reactions ?? []).filter(item => item.reaction_type === option.type).length,
      selected: (comment.reactions ?? []).some(item => item.user_id === viewerId && item.reaction_type === option.type),
    }));
    return <View key={comment.id} style={[styles.commentItem, isReply && styles.commentReply]}>
      <View style={styles.commentAvatar}>
        <Text style={styles.commentAvatarText}>{(comment.author?.display_name || comment.author?.username || 'C').slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.commentMain}>
        <View style={styles.commentBubble}>
          <Text style={styles.commentAuthor}>{comment.author?.display_name || 'CREOVA member'} <Text style={styles.commentHandle}>@{comment.author?.username || 'member'}</Text></Text>
          <Text style={styles.commentBody}>{comment.body}</Text>
          {comment.updated_at !== comment.created_at && <Text style={styles.commentEdited}>Edited</Text>}
        </View>
        <View style={styles.commentMetaRow}>
          <Text style={styles.commentTime}>{new Date(comment.created_at).toLocaleDateString()}</Text>
          {!isReply && <TouchableOpacity onPress={() => { setReplyingTo(comment); setEditingComment(null); setCommentDraft(''); setDeleteConfirmId(null); }}>
            <Text style={styles.commentActionText}>Reply</Text>
          </TouchableOpacity>}
          {ownComment && <TouchableOpacity onPress={() => beginEdit(comment)}>
            <Text style={styles.commentActionText}>Edit</Text>
          </TouchableOpacity>}
          {ownComment && <TouchableOpacity onPress={() => setDeleteConfirmId(deleteConfirmId === comment.id ? null : comment.id)}>
            <Text style={styles.commentDeleteText}>Delete</Text>
          </TouchableOpacity>}
        </View>
        {deleteConfirmId === comment.id && <View style={styles.commentConfirmRow}>
          <Text style={styles.commentConfirmText}>Delete this comment?</Text>
          <TouchableOpacity onPress={() => setDeleteConfirmId(null)}><Text style={styles.commentActionText}>Keep</Text></TouchableOpacity>
          <TouchableOpacity disabled={commentBusy} onPress={() => confirmDelete(comment.id)}><Text style={styles.commentDeleteText}>{commentBusy ? 'Deleting…' : 'Delete'}</Text></TouchableOpacity>
        </View>}
        <View style={styles.commentReactionRow}>
          {counts.map(option => <TouchableOpacity key={option.type} disabled={commentBusy} onPress={() => reactToComment(comment.id, option.type)} style={[styles.commentReactionChip, option.selected && styles.commentReactionSelected]}>
            <Text style={styles.commentReactionText}>{option.emoji}{option.count > 0 ? ` ${option.count}` : ''}</Text>
          </TouchableOpacity>)}
        </View>
      </View>
    </View>;
  }

  const rootComments = comments.filter(comment => !comment.parent_comment_id);

  return <View style={styles.screenContent}>
    <TouchableOpacity onPress={onBack} style={styles.signOutButton}>
      <Text style={styles.signOutText}>‹ Back to profile</Text>
    </TouchableOpacity>
    <Text style={styles.eyebrow}>CREOVA POST</Text>
    <Text style={styles.heading}>Post</Text>
    {loading && <EmptyState title="Loading post" description="Opening this post." />}
    {!loading && !post && <EmptyState title="Post unavailable" description={message || 'This post may have been removed or is not visible to your account.'} />}
    {post && <View style={styles.postDetailCard}>
      <View style={styles.postHeader}>
        <View style={styles.resultAvatar}>
          <Text style={styles.resultAvatarText}>{(post.author?.display_name || post.author?.username || 'C').slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.postAuthor}>
          <Text style={styles.resultName}>{post.author?.display_name || 'CREOVA member'}</Text>
          <Text style={styles.resultHandle}>@{post.author?.username || 'member'} · {post.post_type.toUpperCase()} · {new Date(post.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      {post.media.map(media => media.mediaType === 'video'
        ? <VideoPostPlayer key={media.id} uri={media.signedUrl} />
        : <Image key={media.id} source={{ uri: media.signedUrl }} style={styles.detailImage} resizeMode="contain" />)}
      {!!post.caption && <Text style={styles.postCaption}>{post.caption}</Text>}
      <View style={styles.postActions}>
        <TouchableOpacity disabled={likeBusy} onPress={toggleLike} style={styles.postAction}>
          <Text style={[styles.postActionText, post.likedByMe && styles.postLiked]}>{post.likedByMe ? '♥' : '♡'} {post.likeCount}</Text>
        </TouchableOpacity>
        <View style={styles.postAction}><Text style={styles.postActionText}>▢ {comments.length} comments</Text></View>
      </View>
      <View style={styles.commentsSection}>
        <Text style={styles.subheading}>Conversation</Text>
        {(replyingTo || editingComment) && <View style={styles.replyingBanner}>
          <Text style={styles.replyingBannerText}>{editingComment ? 'Editing your comment' : `Replying to @${replyingTo?.author?.username || 'member'}`}</Text>
          <TouchableOpacity onPress={cancelComposer}><Text style={styles.commentActionText}>Cancel</Text></TouchableOpacity>
        </View>}
        <TextInput
          value={commentDraft}
          onChangeText={setCommentDraft}
          placeholder={replyingTo ? 'Write a reply…' : editingComment ? 'Edit your comment…' : 'Add to the conversation…'}
          placeholderTextColor={COLORS.muted}
          style={styles.commentComposerInput}
          multiline
          maxLength={2000}
          editable={!commentBusy}
        />
        <View style={styles.commentComposerFooter}>
          <Text style={styles.commentCounter}>{commentDraft.length}/2000</Text>
          <TouchableOpacity disabled={commentBusy || !commentDraft.trim()} onPress={submitComment} style={[styles.commentSendButton, (commentBusy || !commentDraft.trim()) && styles.publishButtonDisabled]}>
            <Text style={styles.commentSendText}>{commentBusy ? 'Saving…' : editingComment ? 'Save edit' : replyingTo ? 'Reply' : 'Comment'}</Text>
          </TouchableOpacity>
        </View>
        {!!message && <Text style={styles.notice}>{message}</Text>}
        {commentsLoading && <EmptyState title="Loading comments" description="Getting the conversation." />}
        {!commentsLoading && rootComments.length === 0 && <EmptyState title="Start the conversation" description="Be the first to comment on this post." />}
        {!commentsLoading && rootComments.map(comment => <View key={comment.id} style={styles.commentThread}>
          {renderComment(comment)}
          {comments.filter(reply => reply.parent_comment_id === comment.id).map(reply => renderComment(reply, true))}
        </View>)}
      </View>
    </View>}
  </View>;
}

function PublicProfileScreen({ username, onBack, onOpenProfile, onOpenPost }: {
  username: string;
  onBack: () => void;
  onOpenProfile: (username: string) => void;
  onOpenPost: (postId: string) => void;
}) {
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getProfileByUsername>> | null>(null);
  const [connections, setConnections] = useState<Awaited<ReturnType<typeof getProfileConnections>>>([]);
  const [profilePosts, setProfilePosts] = useState<Awaited<ReturnType<typeof getProfilePosts>>>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [connectionType, setConnectionType] = useState<'followers' | 'following' | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyFollowRequest, setBusyFollowRequest] = useState('');
  const [handledFollowRequests, setHandledFollowRequests] = useState<Record<string, 'accepted' | 'declined'>>({});
  const [message, setMessage] = useState('');

  async function loadProfile() {
    setLoading(true);
    setMessage('');
    try {
      const loadedProfile = await getProfileByUsername(username);
      setProfile(loadedProfile);
      setPostsLoading(true);
      const loadedPosts = await getProfilePosts(loadedProfile.id);
      setProfilePosts(loadedPosts);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load this profile.');
    } finally {
      setPostsLoading(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    setProfile(null);
    setProfilePosts([]);
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
      {profile.is_private && profile.follow_state !== 'accepted'
        ? <Text style={styles.privacyHint}>Follow this private account to see its posts and full activity.</Text>
        : <>
            <StoryHighlightsSection profileId={profile.id} isOwnProfile={false} />
            <View style={styles.profilePostsSection}>
            <Text style={styles.subheading}>Posts</Text>
            <PostGrid posts={profilePosts} loading={postsLoading} onOpenPost={onOpenPost} />
          </View>
          </>}
    </View>}
    {!loading && !profile && <EmptyState title="Profile unavailable" description={message || 'This CREOVA profile could not be found.'} />}
  </View>;
}

function CreateScreen() {
  const [caption, setCaption] = useState('');
  const [postType, setPostType] = useState<'post' | 'anchor' | 'iteration'>('post');
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [selectedMedia, setSelectedMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedCoverUri, setSelectedCoverUri] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notice, setNotice] = useState('');
  const [cameraVisible, setCameraVisible] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const cameraRef = useRef<CameraView | null>(null);
  const pendingVideoRef = useRef<ImagePicker.ImagePickerAsset | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  useEffect(() => {
    const finished = VideoTrim.onFinishTrimming(({ outputPath, duration }) => {
      const original = pendingVideoRef.current;
      if (!original) return;
      const cleanPath = outputPath.startsWith('file://') ? outputPath : 'file://' + outputPath;
      setSelectedCoverUri(null);
      setSelectedMedia({
        ...original,
        uri: cleanPath,
        type: 'video',
        mimeType: 'video/mp4',
        fileSize: null,
        duration,
        width: original.width || 1080,
        height: original.height || 1920,
      });
      pendingVideoRef.current = null;
      setNotice('Video edited. Preview it below before publishing.');
    });
    const cancelled = VideoTrim.onCancel(() => {
      pendingVideoRef.current = null;
      setNotice('Video editing cancelled. Your original video has not been changed.');
    });
    const failed = VideoTrim.onError(({ message }) => {
      pendingVideoRef.current = null;
      setNotice(message || 'The video editor could not open this file.');
    });
    return () => {
      finished.remove();
      cancelled.remove();
      failed.remove();
    };
  }, []);

  function editVideo(asset: ImagePicker.ImagePickerAsset) {
    pendingVideoRef.current = asset;
    setNotice('Opening the Reel editor…');
    try {
      showEditor(asset.uri, {
        maxDuration: 60_000,
        closeWhenFinish: true,
        saveToPhoto: false,
        headerText: 'Edit your Reel',
      });
    } catch (error) {
      pendingVideoRef.current = null;
      setNotice(error instanceof Error ? error.message : 'Could not open the video editor.');
    }
  }

  async function chooseCoverFrame(position: 'start' | 'middle' | 'end') {
    if (!selectedMedia || selectedMedia.type !== 'video' || coverBusy) return;
    setCoverBusy(true);
    setNotice('Extracting your cover frame…');
    try {
      const durationMs = selectedMedia.duration ?? 0;
      const time = position === 'start' ? 0
        : position === 'middle' ? Math.floor(durationMs / 2)
        : Math.max(0, durationMs - 500);
      const frame = await getFrameAt(selectedMedia.uri, {
        time,
        format: 'jpeg',
        quality: 88,
        maxWidth: 720,
      });
      const uri = frame.outputPath.startsWith('file://') ? frame.outputPath : 'file://' + frame.outputPath;
      setSelectedCoverUri(uri);
      setNotice('Cover frame selected. It will be uploaded privately with your Reel.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not extract that cover frame.');
    } finally {
      setCoverBusy(false);
    }
  }

  async function openCamera() {
    setNotice('');
    try {
      const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      if (!camera.granted) {
        setNotice('Allow camera access in your phone settings to record a Reel.');
        return;
      }
      const microphone = microphonePermission?.granted ? microphonePermission : await requestMicrophonePermission();
      if (!microphone.granted) {
        setNotice('Allow microphone access to record a Reel with sound.');
        return;
      }
      setRecordingDuration(0);
      setCameraVisible(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not request camera access.');
    }
  }

  async function startRecording() {
    if (!cameraRef.current || recording) return;
    setRecording(true);
    setRecordingDuration(0);
    setNotice('');
    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: 60,
        maxFileSize: 50 * 1024 * 1024,
        progressUpdateInterval: 0.5,
      });
      if (result?.uri) {
        setCameraVisible(false);
        const asset = {
          assetId: null, base64: null, duration: null, exif: null,
          fileName: 'creova-reel.mp4', height: 1920,
          mimeType: 'video/mp4', type: 'video' as const, uri: result.uri, width: 1080,
        } as ImagePicker.ImagePickerAsset;
        editVideo(asset);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Recording failed. Please try again.');
    } finally {
      setRecording(false);
    }
  }

  function stopRecording() {
    if (recording) cameraRef.current?.stopRecording();
    else setCameraVisible(false);
  }

  async function chooseImage() {
    setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'], allowsEditing: false, quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mediaType = asset.type === 'video' || asset.mimeType?.startsWith('video/') ? 'video' : 'image';
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
        if (mediaType === 'video') {
          editVideo({ ...asset, mimeType });
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
    setUploadProgress(0);
    setNotice('');
    try {
      if (selectedMedia) {
        await createPostWithMedia({
          caption, postType, visibility,
          media: {
            uri: selectedMedia.uri,
            mimeType: selectedMedia.mimeType ?? 'image/jpeg',
            fileSize: selectedMedia.fileSize ?? null,
            width: selectedMedia.width,
            height: selectedMedia.height,
            mediaType: selectedMedia.type === 'video' || selectedMedia.mimeType?.startsWith('video/') ? 'video' : 'image',
            durationSeconds: selectedMedia.type === 'video' && selectedMedia.duration ? selectedMedia.duration / 1000 : null,
            coverUri: selectedMedia.type === 'video' ? selectedCoverUri : null,
          },
        }, setUploadProgress);
      } else {
        await createPost({ caption, postType, visibility });
      }
      setCaption('');
      setSelectedMedia(null);
      setSelectedCoverUri(null);
      setNotice('Published. Your post is now in your CREOVA feed.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not publish your post.');
    } finally {
      setPublishing(false);
      setUploadProgress(0);
    }
  }

  return <View style={styles.screenContent}>
    <Text style={styles.eyebrow}>MAKE SOMETHING THAT MOVES</Text>
    <Text style={styles.heading}>Create</Text>
    <View style={styles.composerCard}>
      <Text style={styles.composerTitle}>Share an update</Text>
      <Text style={styles.composerHint}>Write a post, upload a clip, or record a Reel without leaving CREOVA.</Text>
      <TextInput value={caption} onChangeText={setCaption} multiline maxLength={2200}
        placeholder="What are you creating, learning, or evolving?" placeholderTextColor="#71819C"
        style={styles.composerInput} textAlignVertical="top" />
      <Text style={styles.composerCount}>{caption.length}/2200</Text>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <TouchableOpacity onPress={openCamera} disabled={publishing} style={styles.imagePickButton}>
          <Text style={styles.imagePickButtonText}>● Record a Reel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={chooseImage} disabled={publishing} style={styles.imagePickButton}>
          <Text style={styles.imagePickButtonText}>{selectedMedia ? 'Change media' : '＋ Upload photo/video'}</Text>
        </TouchableOpacity>
      </View>
      {selectedMedia && <View style={styles.imagePreviewWrap}>
        {selectedMedia.type === 'video'
          ? <View style={[styles.imagePreview, { overflow: 'hidden' }]}>{selectedCoverUri
              ? <Image source={{ uri: selectedCoverUri }} style={styles.imagePreview} resizeMode="cover" />
              : <ReelVideo uri={selectedMedia.uri} active />}
            <View style={{ position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.72)' }}><Text style={styles.videoPreviewText}>{selectedCoverUri ? 'SELECTED REEL COVER' : 'REEL PREVIEW'} · {Math.round((selectedMedia.duration ?? 0) / 1000)} SEC</Text></View>
          </View>
          : <Image source={{ uri: selectedMedia.uri }} style={styles.imagePreview} resizeMode="cover" />}
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {selectedMedia.type === 'video' && <>
            <TouchableOpacity onPress={() => editVideo(selectedMedia)} style={styles.removeImageButton}><Text style={styles.removeImageText}>Trim again</Text></TouchableOpacity>
            <TouchableOpacity disabled={coverBusy} onPress={() => chooseCoverFrame('start')} style={styles.removeImageButton}><Text style={styles.removeImageText}>Opening frame</Text></TouchableOpacity>
            <TouchableOpacity disabled={coverBusy} onPress={() => chooseCoverFrame('middle')} style={styles.removeImageButton}><Text style={styles.removeImageText}>Middle frame</Text></TouchableOpacity>
            <TouchableOpacity disabled={coverBusy} onPress={() => chooseCoverFrame('end')} style={styles.removeImageButton}><Text style={styles.removeImageText}>Ending frame</Text></TouchableOpacity>
            {selectedCoverUri && <TouchableOpacity onPress={() => setSelectedCoverUri(null)} style={styles.removeImageButton}><Text style={styles.removeImageText}>Reset cover</Text></TouchableOpacity>}
          </>}
          <TouchableOpacity onPress={() => { setSelectedMedia(null); setSelectedCoverUri(null); }} style={styles.removeImageButton}><Text style={styles.removeImageText}>Remove media</Text></TouchableOpacity>
        </View>
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
        <Text style={styles.publishButtonText}>{publishing ? (selectedMedia ? 'Uploading media…' : 'Publishing…') : selectedMedia?.type === 'video' ? 'Publish Reel' : 'Publish post'}</Text>
      </TouchableOpacity>
      {publishing && selectedMedia && <View style={styles.uploadProgressWrap}>
        <View style={styles.uploadProgressTrack}><View style={[styles.uploadProgressFill, { width: Math.round(uploadProgress) + '%' }]} /></View>
        <Text style={styles.uploadProgressText}>{Math.round(uploadProgress)}% uploaded · automatic retries enabled</Text>
        <TouchableOpacity onPress={cancelActivePostMediaUpload} style={styles.cancelUploadButton}><Text style={styles.cancelUploadText}>Cancel upload</Text></TouchableOpacity>
      </View>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
    </View>
    <View style={styles.createOption}><Text style={styles.optionSymbol}>▶</Text><View style={styles.optionText}><Text style={styles.optionTitle}>Reels Studio</Text><Text style={styles.optionDescription}>Record inside CREOVA, trim your clip in the native editor, preview it, then publish through the existing secure media pipeline.</Text></View><Text style={styles.optionArrow}>›</Text></View>
    <Modal visible={cameraVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={stopRecording}>
      <View style={{ flex: 1, backgroundColor: '#03060D' }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing={cameraFacing} mode="video" videoQuality="720p"
          onRecordingProgress={event => setRecordingDuration(Math.floor(event.duration))}
          onMountError={event => setNotice(event.message)} />
        <View style={{ position: 'absolute', top: 42, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={stopRecording} style={{ padding: 12 }}><Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Close</Text></TouchableOpacity>
          <Text style={{ color: '#FFFFFF', fontWeight: '900', letterSpacing: 1 }}>CREOVA CAMERA</Text>
          <TouchableOpacity disabled={recording} onPress={() => setCameraFacing(value => value === 'back' ? 'front' : 'back')} style={{ padding: 12 }}><Text style={{ color: '#FFFFFF', fontSize: 16 }}>↻</Text></TouchableOpacity>
        </View>
        <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center', gap: 14 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{recording ? 'RECORDING · ' + Math.min(60, recordingDuration) + 's / 60s' : 'UP TO 60 SECONDS'}</Text>
          <TouchableOpacity onPress={recording ? stopRecording : startRecording} style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#FFFFFF', backgroundColor: recording ? '#E54862' : '#3985FF', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: recording ? 25 : 54, height: recording ? 25 : 54, borderRadius: recording ? 6 : 27, backgroundColor: '#FFFFFF' }} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}

function InboxScreen({ onOpenProfile, onOpenPost, onUnreadCountChange, onBack }: {
  onOpenProfile: (username: string) => void;
  onOpenPost: (postId: string) => void;
  onUnreadCountChange: (count: number) => void;
  onBack: () => void;
}) {
  const [notifications, setNotifications] = useState<CreovaNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyFollowRequest, setBusyFollowRequest] = useState('');
  const [handledFollowRequests, setHandledFollowRequests] = useState<Record<string, 'accepted' | 'declined'>>({});
  const [activeFilter, setActiveFilter] = useState<'All' | 'Likes' | 'Comments' | 'Follows'>('All');
  const [message, setMessage] = useState('');

  async function loadNotifications() {
    try {
      const [items, unreadCount] = await Promise.all([
        getMyNotifications(),
        getUnreadNotificationCount(),
      ]);
      setNotifications(items);
      onUnreadCountChange(unreadCount);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof subscribeToMyNotifications> | null = null;
    async function start() {
      await loadNotifications();
      if (!active || !supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      channel = subscribeToMyNotifications(data.user.id, () => {
        void loadNotifications();
      });
    }
    void start();
    return () => {
      active = false;
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, []);

  async function markAllRead() {
    if (busy || notifications.every(item => !!item.read_at)) return;
    setBusy(true);
    setMessage('');
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications(items => items.map(item => ({ ...item, read_at: item.read_at ?? readAt })));
      onUnreadCountChange(0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not mark notifications as read.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFollowRequest(notification: CreovaNotification, accept: boolean) {
    if (busyFollowRequest) return;
    setBusyFollowRequest(notification.id);
    setMessage('');
    try {
      await respondToFollowRequest(notification.actor_id, accept);
      await markNotificationRead(notification.id);
      setHandledFollowRequests(current => ({
        ...current,
        [notification.id]: accept ? 'accepted' : 'declined',
      }));
      setNotifications(items => items.map(item => item.id === notification.id
        ? { ...item, read_at: new Date().toISOString() }
        : item));
      const remainingUnread = notifications.filter(item => !item.read_at && item.id !== notification.id).length;
      onUnreadCountChange(remainingUnread);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not respond to this follow request.');
    } finally {
      setBusyFollowRequest('');
    }
  }

  async function openNotification(notification: CreovaNotification) {
    if (!notification.read_at) {
      try {
        await markNotificationRead(notification.id);
        setNotifications(items => items.map(item => item.id === notification.id
          ? { ...item, read_at: new Date().toISOString() }
          : item));
        onUnreadCountChange(Math.max(0, notifications.filter(item => !item.read_at).length - 1));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not update this notification.');
        return;
      }
    }
    if (notification.post_id) {
      onOpenPost(notification.post_id);
    } else if (notification.actor?.username) {
      onOpenProfile(notification.actor.username);
    }
  }

  function notificationMessage(item: CreovaNotification) {
    switch (item.notification_type) {
      case 'follow_request': return 'requested to follow you';
      case 'new_follower': return 'started following you';
      case 'follow_accepted': return 'accepted your follow request';
      case 'post_like': return 'liked your post';
      case 'post_comment': return 'commented on your post';
      case 'comment_reply': return 'replied to a comment';
      case 'post_repost': return 'reposted your post';
      default: return 'interacted with you';
    }
  }

  const unreadCount = notifications.filter(item => !item.read_at).length;
  const filterTypes: Record<typeof activeFilter, CreovaNotification['notification_type'][] | null> = {
    All: null,
    Likes: ['post_like'],
    Comments: ['post_comment', 'comment_reply'],
    Follows: ['follow_request', 'new_follower', 'follow_accepted'],
  };
  const filteredNotifications = activeFilter === 'All'
    ? notifications
    : notifications.filter(item => filterTypes[activeFilter]?.includes(item.notification_type));

  return <View style={styles.screenContent}>
    <TouchableOpacity onPress={onBack} style={styles.signOutButton}>
      <Text style={styles.signOutText}>‹ Back to messages</Text>
    </TouchableOpacity>
    <View style={styles.notificationHeaderRow}>
      <View>
        <Text style={styles.eyebrow}>YOUR ACTIVITY</Text>
        <Text style={styles.heading}>Notifications</Text>
        <Text style={styles.notificationSubtitle}>{unreadCount} unread</Text>
      </View>
      <TouchableOpacity
        onPress={markAllRead}
        disabled={busy || unreadCount === 0}
        style={[styles.notificationMarkAll, (busy || unreadCount === 0) && styles.notificationMarkAllDisabled]}
      >
        <Text style={styles.notificationMarkAllText}>{busy ? 'Updating…' : 'Mark all read'}</Text>
      </TouchableOpacity>
    </View>
    {!!message && <Text style={styles.notice}>{message}</Text>}
    <View style={styles.notificationFilters}>
      {(['All', 'Likes', 'Comments', 'Follows'] as const).map(filter => {
        const count = filter === 'All'
          ? notifications.length
          : notifications.filter(item => filterTypes[filter]?.includes(item.notification_type)).length;
        return (
          <TouchableOpacity
            key={filter}
            onPress={() => setActiveFilter(filter)}
            style={[styles.notificationFilterChip, activeFilter === filter && styles.notificationFilterChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === filter }}
          >
            <Text style={[styles.notificationFilterText, activeFilter === filter && styles.notificationFilterTextActive]}>
              {filter} <Text style={styles.notificationFilterCount}>{count}</Text>
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
    {loading && <EmptyState title="Loading notifications" description="Checking your latest CREOVA activity." />}
    {!loading && notifications.length === 0 && <EmptyState title="You’re all caught up" description="Likes, comments, replies, and new followers will show up here." />}
    {!loading && notifications.length > 0 && filteredNotifications.length === 0 && <EmptyState title={`No ${activeFilter.toLowerCase()} yet`} description="New activity in this category will appear here." />}
    {!loading && filteredNotifications.map(item => {
      const handled = handledFollowRequests[item.id];
      const isFollowRequest = item.notification_type === 'follow_request' && !handled;
      return (
        <View key={item.id} style={[styles.notificationCard, !item.read_at && styles.notificationCardUnread]}>
          <TouchableOpacity
            onPress={() => openNotification(item)}
            style={styles.notificationMainTap}
            accessibilityRole="button"
            accessibilityLabel={`${item.actor?.display_name || 'A CREOVA member'} ${notificationMessage(item)}`}
          >
            <View style={styles.notificationAvatar}>
              {item.actor?.avatar_url
                ? <Image source={{ uri: item.actor.avatar_url }} style={styles.notificationAvatarImage} />
                : <Text style={styles.notificationAvatarText}>{(item.actor?.display_name || item.actor?.username || 'C').slice(0, 1).toUpperCase()}</Text>}
            </View>
            <View style={styles.notificationContent}>
              <Text style={styles.notificationActorLine}>
                <Text style={styles.notificationActor}>{item.actor?.display_name || 'A CREOVA member'}</Text>
                {' '}{handled ? (handled === 'accepted' ? 'follow request accepted' : 'follow request declined') : notificationMessage(item)}
              </Text>
              <Text style={styles.notificationTime}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            {!item.read_at && <View style={styles.notificationUnreadDot} />}
          </TouchableOpacity>
          {isFollowRequest && (
            <View style={styles.followRequestActions}>
              <TouchableOpacity
                onPress={() => handleFollowRequest(item, true)}
                disabled={!!busyFollowRequest}
                style={[styles.followAcceptButton, !!busyFollowRequest && styles.notificationMarkAllDisabled]}
              >
                <Text style={styles.followAcceptText}>{busyFollowRequest === item.id ? 'Please wait…' : 'Accept'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleFollowRequest(item, false)}
                disabled={!!busyFollowRequest}
                style={[styles.followDeclineButton, !!busyFollowRequest && styles.notificationMarkAllDisabled]}
              >
                <Text style={styles.followDeclineText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    })}
  </View>;
}

function ProfileScreen({ onOpenPost }: { onOpenPost: (postId: string) => void }) {
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
  const [profilePosts, setProfilePosts] = useState<Awaited<ReturnType<typeof getProfilePosts>>>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [notificationPreferences, setNotificationPreferences] = useState<CreovaNotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [savingPreference, setSavingPreference] = useState(false);
  const [pushStatus, setPushStatus] = useState<'checking' | 'enabled' | 'disabled' | 'unsupported' | 'setup-required'>('checking');
  const [pushBusy, setPushBusy] = useState(false);

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
    getMyNotificationPreferences().then(value => {
      if (active) setNotificationPreferences(value);
    }).catch(preferencesError => {
      if (active) setNotice(preferencesError instanceof Error ? preferencesError.message : 'Could not load notification preferences.');
    }).finally(() => {
      if (active) setPreferencesLoading(false);
    });
    getMyProfile().then(value => {
      if (!active) return;
      setProfile(value);
      getProfilePosts(value.id).then(items => {
        if (active) setProfilePosts(items);
      }).catch(postsError => {
        if (active) setNotice(postsError instanceof Error ? postsError.message : 'Could not load your posts.');
      }).finally(() => {
        if (active) setPostsLoading(false);
      });
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

  useEffect(() => {
    let active = true;
    getThisDevicePushStatus().then(status => {
      if (active) setPushStatus(status);
    }).catch(() => {
      if (active) setPushStatus('disabled');
    });
    return () => { active = false; };
  }, []);

  async function togglePushNotifications() {
    if (pushBusy || pushStatus === 'checking' || pushStatus === 'unsupported' || pushStatus === 'setup-required') return;
    setPushBusy(true);
    setNotice('');
    try {
      if (pushStatus === 'enabled') {
        await disableThisDevicePushNotifications();
        setPushStatus('disabled');
        setNotice('Push notifications are disabled on this device.');
      } else {
        const result = await registerThisDeviceForPushNotifications();
        if (result.status === 'registered') {
          setPushStatus('enabled');
          setNotice('Push notifications are enabled on this device.');
        } else if (result.status === 'permission-denied') {
          setPushStatus('disabled');
          setNotice('Notification permission was not granted. You can enable it in your device settings.');
        } else {
          setPushStatus('unsupported');
          setNotice('Push notifications require a supported physical device.');
        }
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update push notification settings.');
    } finally {
      setPushBusy(false);
    }
  }

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

  async function updateNotificationPreference(
    key: keyof CreovaNotificationPreferences,
    value: boolean,
  ) {
    if (savingPreference) return;
    const previous = notificationPreferences;
    const next = { ...previous, [key]: value };
    setNotificationPreferences(next);
    setSavingPreference(true);
    setNotice('');
    try {
      const saved = await saveMyNotificationPreferences(next);
      setNotificationPreferences(saved);
      setNotice('Notification preferences saved.');
    } catch (e) {
      setNotificationPreferences(previous);
      setNotice(e instanceof Error ? e.message : 'Could not save notification preferences.');
    } finally {
      setSavingPreference(false);
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
      <View style={styles.notificationPreferencesCard}>
        <View style={styles.notificationPreferencesHeading}>
          <Text style={styles.subheading}>Notification preferences</Text>
          <Text style={styles.privacyHint}>Choose which in-app activity alerts appear in your Inbox.</Text>
        </View>
        {preferencesLoading
          ? <Text style={styles.privacyHint}>Loading preferences…</Text>
          : ([
              { key: 'likes_enabled', title: 'Likes', description: 'When someone likes your posts' },
              { key: 'comments_enabled', title: 'Comments and replies', description: 'When someone comments or replies to you' },
              { key: 'follows_enabled', title: 'Follows', description: 'Follow requests, new followers and accepted requests' },
              { key: 'reposts_enabled', title: 'Reposts', description: 'When someone reposts your content' },
            ] as { key: keyof CreovaNotificationPreferences; title: string; description: string }[]).map(item => (
              <View key={item.key} style={styles.notificationPreferenceRow}>
                <View style={styles.notificationPreferenceCopy}>
                  <Text style={styles.notificationPreferenceTitle}>{item.title}</Text>
                  <Text style={styles.privacyHint}>{item.description}</Text>
                </View>
                <Switch
                  value={notificationPreferences[item.key]}
                  onValueChange={value => updateNotificationPreference(item.key, value)}
                  disabled={savingPreference || preferencesLoading}
                  trackColor={{ false: '#34445F', true: '#3985FF' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
        {savingPreference && <Text style={styles.privacyHint}>Saving your choice…</Text>}
      </View>
      <View style={styles.notificationPreferencesCard}>
        <View style={styles.notificationPreferencesHeading}>
          <Text style={styles.subheading}>Push notifications</Text>
          <Text style={styles.privacyHint}>Receive CREOVA activity alerts when the app is closed.</Text>
        </View>
        {pushStatus === 'checking'
          ? <Text style={styles.privacyHint}>Checking this device…</Text>
          : pushStatus === 'setup-required'
            ? <Text style={styles.privacyHint}>Expo project linking is required before this device can register for push alerts.</Text>
            : pushStatus === 'unsupported'
              ? <Text style={styles.privacyHint}>Push alerts are available on supported physical Android and iOS devices.</Text>
              : <TouchableOpacity
                  onPress={togglePushNotifications}
                  disabled={pushBusy}
                  style={styles.pushNotificationButton}
                >
                  <Text style={styles.pushNotificationButtonText}>
                    {pushBusy ? 'Updating…' : pushStatus === 'enabled' ? 'Disable on this device' : 'Enable on this device'}
                  </Text>
                </TouchableOpacity>}
      </View>
      <StoryHighlightsSection profileId={profile.id} isOwnProfile />
      <View style={styles.profilePostsSection}>
        <Text style={styles.subheading}>Your posts</Text>
        <PostGrid posts={profilePosts} loading={postsLoading} onOpenPost={onOpenPost} />
      </View>
      <TouchableOpacity onPress={signOut} style={styles.signOutButton}><Text style={styles.signOutText}>Sign out</Text></TouchableOpacity>
    </View> : <EmptyState title={error || 'Loading your profile…'} description={error ? 'Check your connection and try again.' : 'Your account profile is being loaded from CREOVA.'} />}
    <EmptyState title="Your evolution starts here" description="Your posts, Anchors, Iterations, skills, and proof of execution will come together on your profile." />
  </View>;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showActivity, setShowActivity] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  function handlePushNotificationData(data: Record<string, unknown>) {
    const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;
    if (notificationId) void markNotificationRead(notificationId).catch(() => undefined);

    if (data.notificationType === 'follow_request') {
      setShowActivity(true);
      setSelectedPostId(null);
      setSelectedProfileUsername(null);
      setActiveTab('Inbox');
      return;
    }

    const postId = typeof data.postId === 'string' ? data.postId : null;
    if (postId) {
      setShowActivity(false);
      setSelectedProfileUsername(null);
      setSelectedPostId(postId);
      setActiveTab('Home');
      return;
    }

    const actorUsername = typeof data.actorUsername === 'string' ? data.actorUsername : null;
    if (actorUsername) {
      setShowActivity(false);
      setSelectedPostId(null);
      setSelectedProfileUsername(actorUsername);
      setActiveTab('Discover');
    } else {
      setShowActivity(true);
      setSelectedPostId(null);
      setSelectedProfileUsername(null);
      setActiveTab('Inbox');
    }
  }

  useEffect(() => {
    const subscription = addPushNotificationResponseListener(handlePushNotificationData);
    getInitialPushNotificationResponse().then(data => {
      if (data) handlePushNotificationData(data);
    }).catch(() => undefined);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof subscribeToMyNotifications> | null = null;
    async function startNotifications() {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      try {
        setUnreadNotificationCount(await getUnreadNotificationCount());
      } catch {
        if (active) setUnreadNotificationCount(0);
      }
      if (!active) return;
      channel = subscribeToMyNotifications(data.user.id, () => {
        void getUnreadNotificationCount().then(count => {
          if (active) setUnreadNotificationCount(count);
        }).catch(() => undefined);
      }, 'badge');
    }
    void startNotifications();
    return () => {
      active = false;
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, []);

  const openProfile = (username: string) => {
    setShowActivity(false);
    setSelectedPostId(null);
    setSelectedProfileUsername(username);
    setActiveTab('Discover');
  };

  const openPost = (postId: string) => {
    setShowActivity(false);
    setSelectedProfileUsername(null);
    setSelectedPostId(postId);
  };

  const openActivity = () => {
    setSelectedPostId(null);
    setSelectedProfileUsername(null);
    setShowActivity(true);
  };

  const renderScreen = () => {
    if (showActivity) {
      return <InboxScreen onOpenProfile={openProfile} onOpenPost={openPost} onUnreadCountChange={setUnreadNotificationCount} onBack={() => setShowActivity(false)} />;
    }
    if (selectedPostId) {
      return <PostDetailScreen postId={selectedPostId} onBack={() => setSelectedPostId(null)} />;
    }
    if (selectedProfileUsername) {
      return <PublicProfileScreen
        username={selectedProfileUsername}
        onBack={() => setSelectedProfileUsername(null)}
        onOpenProfile={setSelectedProfileUsername}
        onOpenPost={setSelectedPostId}
      />;
    }
    switch (activeTab) {
      case 'Reels': return <ReelsScreen onOpenPost={openPost} />;
      case 'Discover': return <DiscoverScreen onOpenProfile={openProfile} />;
      case 'Create': return <CreateScreen />;
      case 'Inbox': return <MessagingInbox />;
      case 'Profile': return <ProfileScreen onOpenPost={setSelectedPostId} />;
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
          <TouchableOpacity onPress={openActivity} style={styles.topBarAction} accessibilityRole="button" accessibilityLabel="Notifications">
            <Text style={styles.topBarActionText}>♢</Text>
            {unreadNotificationCount > 0 && <Text style={styles.navUnreadBadge}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</Text>}
          </TouchableOpacity>
        </View>
        <View style={[styles.body, isWide && styles.bodyWide]}>
          {isWide && <View style={styles.sideNav}>
            {TABS.map(tab => <TouchableOpacity key={tab.key} onPress={() => { setShowActivity(false); setSelectedPostId(null); setSelectedProfileUsername(null); setActiveTab(tab.key); }} style={[styles.sideNavItem, activeTab === tab.key && styles.sideNavItemActive]}>
              <View style={styles.navIconWrap}>
                <Text style={[styles.sideNavSymbol, activeTab === tab.key && styles.activeText]}>{tab.symbol}</Text>
                </View>
              <Text style={[styles.sideNavLabel, activeTab === tab.key && styles.activeText]}>{tab.label}</Text>
            </TouchableOpacity>)}
          </View>}
          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainScrollContent} showsVerticalScrollIndicator={false} scrollEnabled={activeTab !== 'Reels'}>
            <View style={[styles.contentMax, isWide && styles.contentMaxWide]}>{renderScreen()}</View>
          </ScrollView>
        </View>
        {!isWide && <View style={styles.bottomNav}>
          {TABS.map(tab => <TouchableOpacity key={tab.key} onPress={() => { setShowActivity(false); setSelectedPostId(null); setSelectedProfileUsername(null); setActiveTab(tab.key); }} style={styles.bottomNavItem} accessibilityRole="button" accessibilityLabel={tab.label} accessibilityState={{ selected: activeTab === tab.key }}>
            <View style={styles.navIconWrap}>
              <Text style={[styles.bottomNavSymbol, activeTab === tab.key && styles.activeText, tab.key === 'Create' && styles.createSymbol]}>{tab.symbol}</Text>
            </View>
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
  topBarAction: { width: 38, height: 38, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', position: 'relative' },
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
  uploadProgressWrap: { gap: 8, paddingTop: 3 },
  uploadProgressTrack: { height: 7, borderRadius: 5, overflow: 'hidden', backgroundColor: '#263650' },
  uploadProgressFill: { height: '100%', borderRadius: 5, backgroundColor: COLORS.blue },
  uploadProgressText: { color: COLORS.muted, fontSize: 10 },
  cancelUploadButton: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 3 },
  cancelUploadText: { color: '#FF91A9', fontSize: 11, fontWeight: '700' },
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
  profilePostsSection: { width: '100%', gap: 13, marginTop: 12 },
  postGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridTile: { width: '31.7%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.surfaceRaised, position: 'relative' },
  gridImage: { width: '100%', height: '100%', backgroundColor: '#0B1322' },
  gridVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#14233B' },
  gridVideoIcon: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  gridVideoDuration: { color: '#C9D9F4', fontSize: 9, fontWeight: '800', marginTop: 4 },
  gridTextPost: { padding: 9, justifyContent: 'center' },
  gridTextPreview: { color: '#DCE7F9', fontSize: 9, lineHeight: 13 },
  gridMultiple: { position: 'absolute', top: 5, right: 6, backgroundColor: '#07101FCC', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  gridMultipleText: { color: '#FFFFFF', fontSize: 12 },
  videoPreview: { alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#14233B' },
  videoPreviewIcon: { color: '#FFFFFF', fontSize: 35, fontWeight: '900' },
  videoPreviewText: { color: '#C9D9F4', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  commentsSection: { gap: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 15 },
  commentThread: { gap: 8, paddingBottom: 8 },
  commentItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  commentReply: { marginLeft: 34 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: '#A7C6FF', fontSize: 11, fontWeight: '800' },
  commentMain: { flex: 1, gap: 5 },
  commentBubble: { backgroundColor: '#0B1322', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, gap: 5 },
  commentAuthor: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  commentHandle: { color: COLORS.muted, fontWeight: '500' },
  commentBody: { color: COLORS.text, fontSize: 12, lineHeight: 18 },
  commentEdited: { color: COLORS.muted, fontSize: 9 },
  commentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 3 },
  commentTime: { color: COLORS.muted, fontSize: 9 },
  commentActionText: { color: '#9ABEFF', fontSize: 10, fontWeight: '800' },
  commentDeleteText: { color: '#FF91A9', fontSize: 10, fontWeight: '800' },
  commentConfirmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 3 },
  commentConfirmText: { color: COLORS.text, fontSize: 10, flex: 1 },
  commentReactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingLeft: 2 },
  commentReactionChip: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 12, backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border },
  commentReactionSelected: { borderColor: '#6F9FE8', backgroundColor: COLORS.accentSoft },
  commentReactionText: { color: COLORS.text, fontSize: 9 },
  replyingBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.accentSoft, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 },
  replyingBannerText: { color: '#A7C6FF', fontSize: 10, fontWeight: '700' },
  commentComposerInput: { minHeight: 76, maxHeight: 150, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#0B1322', color: COLORS.text, padding: 12, fontSize: 12, lineHeight: 18, textAlignVertical: 'top' },
  commentComposerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commentCounter: { color: COLORS.muted, fontSize: 9 },
  commentSendButton: { minHeight: 34, paddingHorizontal: 15, borderRadius: 10, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' },
  commentSendText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  postDetailCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 15, gap: 14 },
  detailImage: { width: '100%', aspectRatio: 1, borderRadius: 13, backgroundColor: '#050A13' },
  detailVideo: { width: '100%', aspectRatio: 9 / 16, borderRadius: 13, backgroundColor: '#050A13' },
  profileEditor: { width: '100%', gap: 10, marginTop: 8 },
  editLabel: { color: '#AFC5E8', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  editInput: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#0B1322', color: COLORS.text, paddingHorizontal: 12, fontSize: 13 },
  bioInput: { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  privacyText: { flex: 1, gap: 5 },
  privacyHint: { color: COLORS.muted, fontSize: 10 },
  signOutButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  signOutText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  bottomNavLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '600' },
  navIconWrap: { position: 'relative', minWidth: 27, alignItems: 'center', justifyContent: 'center' },
  navUnreadBadge: { position: 'absolute', top: -5, right: -12, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, overflow: 'hidden', backgroundColor: '#FF5578', color: '#FFFFFF', fontSize: 8, lineHeight: 16, fontWeight: '900', textAlign: 'center' },
  notificationHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  notificationSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 5 },
  pushNotificationButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 11, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: '#355B9C' },
  pushNotificationButtonText: { color: '#A7C6FF', fontSize: 11, fontWeight: '800' },
  notificationPreferencesCard: { width: '100%', marginTop: 18, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 12 },
  notificationPreferencesHeading: { gap: 5, paddingBottom: 4 },
  notificationPreferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#202E45' },
  notificationPreferenceCopy: { flex: 1, gap: 4 },
  notificationPreferenceTitle: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  notificationFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 4 },
  notificationFilterChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  notificationFilterChipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.blue },
  notificationFilterText: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  notificationFilterTextActive: { color: '#C6DAFF' },
  notificationFilterCount: { color: '#7890B4', fontSize: 9, fontWeight: '700' },
  notificationMarkAll: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: '#355B9C' },
  notificationMarkAllDisabled: { opacity: 0.45 },
  notificationMarkAllText: { color: '#A7C6FF', fontSize: 10, fontWeight: '800' },
  notificationCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  notificationCardUnread: { borderColor: '#4268A4', backgroundColor: '#12213A' },
  notificationAvatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  notificationAvatarImage: { width: 42, height: 42, borderRadius: 15 },
  notificationAvatarText: { color: '#A7C6FF', fontSize: 16, fontWeight: '900' },
  notificationContent: { flex: 1, gap: 5 },
  notificationActorLine: { color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  notificationActor: { color: COLORS.text, fontWeight: '900' },
  notificationTime: { color: COLORS.muted, fontSize: 9 },
  notificationUnreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.blue },
  notificationMainTap: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  followRequestActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingLeft: 53, paddingTop: 9 },
  followAcceptButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 9, backgroundColor: COLORS.blue },
  followAcceptText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  followDeclineButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 9, backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border },
  followDeclineText: { color: COLORS.muted, fontSize: 10, fontWeight: '800' }
});


export default function App() {
  return <AuthGate><MainApp /></AuthGate>;
}
