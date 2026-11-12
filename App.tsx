import React, { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { AuthGate } from './src/features/auth/AuthGate';
import { getMyProfile, getMyProfileCounts, getMyFollowList, searchProfiles, getFollowStates, followProfile, unfollowProfile, getIncomingFollowRequests, respondToFollowRequest, updateMyProfile, uploadMyAvatar, removeMyAvatar } from './src/features/profile/profileService';
import type { CreovaProfile, FollowListEntry } from './src/features/profile/profileService';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from './src/features/notifications/notificationService';
import type { CreovaNotification } from './src/features/notifications/notificationService';
import { createPost, createPostWithMedia, getHomeFeed, getForYouFeed, getMyPosts, getPostById, getSavedPosts, togglePostLike, togglePostRepost, togglePostSave, getPostComments, createPostComment, getCommentReactionSummaries, setCommentReaction, setPostPinned } from './src/features/posts/postService';
import type { CreovaFeedPost, CreovaPostComment, CommentReactionType, CommentReactionSummary } from './src/features/posts/postService';
import { getActiveStories, publishStory, markStoryViewed, reactToStory, replyToStory, getMyStoryViewers, deleteStory } from './src/features/stories/storyService';
import type { CreovaStory } from './src/features/stories/storyService';
import {
  getMyConversations, getConversationMessages, createConversation, sendMessage,
  markConversationRead, respondToMessageRequest, getCurrentMessagingUserId,
  subscribeToConversationMessages, subscribeToInboxChanges, createMessageClientId,
} from './src/features/messaging/messageService';
import type { CreovaConversation, CreovaMessage, MessageAttachmentInput } from './src/features/messaging/messageService';
import { supabase, requireSupabase } from './src/lib/supabase';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
  StyleSheet,
  TextInput,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Switch,
  Modal,
  Share,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';

type Tab = 'Home' | 'Discover' | 'Create' | 'Inbox' | 'Profile';

const COLORS = {
  background: '#000000',
  surface: '#101827',
  surfaceRaised: '#192840',
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✦</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

function FeedVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 4 / 5, backgroundColor: '#000000' }} contentFit="contain" nativeControls />;
}

function StoryVideo({ uri, onFinish }: { uri: string; onFinish: () => void }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = false;
    instance.play();
  });
  useEffect(() => {
    const subscription = player.addListener('playToEnd', onFinish);
    return () => subscription.remove();
  }, [player, onFinish]);
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />;
}

function HomeScreen({ sharedPostId, onSharedPostHandled }: { sharedPostId: string | null; onSharedPostHandled: () => void }) {
  const [posts, setPosts] = useState<CreovaFeedPost[]>([]);
  const [feedMode, setFeedMode] = useState<'following' | 'for-you'>('following');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busyPost, setBusyPost] = useState('');
  const [postActionBusy, setPostActionBusy] = useState('');
  const [commentPost, setCommentPost] = useState<CreovaFeedPost | null>(null);
  const [comments, setComments] = useState<CreovaPostComment[]>([]);
  const [reactionSummaries, setReactionSummaries] = useState<Record<string, CommentReactionSummary>>({});
  const [reactionBusyId, setReactionBusyId] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTo, setReplyTo] = useState<CreovaPostComment | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentMessage, setCommentMessage] = useState('');

  async function openComments(post: CreovaFeedPost) {
    setCommentPost(post);
    setComments([]);
    setCommentDraft('');
    setReplyTo(null);
    setCommentMessage('');
    setCommentsLoading(true);
    try {
      const loadedComments = await getPostComments(post.id);
      setComments(loadedComments);
      setReactionSummaries(await getCommentReactionSummaries(loadedComments.map(comment => comment.id)));
    } catch (error) {
      setCommentMessage(error instanceof Error ? error.message : 'Could not load comments.');
    } finally {
      setCommentsLoading(false);
    }
  }

  async function handleCommentReaction(commentId: string, reaction: CommentReactionType) {
    if (reactionBusyId) return;
    setReactionBusyId(commentId);
    setCommentMessage('');
    try {
      const current = reactionSummaries[commentId]?.myReaction ?? null;
      await setCommentReaction(commentId, current === reaction ? null : reaction);
      setReactionSummaries(await getCommentReactionSummaries(comments.map(comment => comment.id)));
    } catch (error) {
      setCommentMessage(error instanceof Error ? error.message : 'Could not update your reaction.');
    } finally {
      setReactionBusyId('');
    }
  }

  async function submitComment() {
    if (!commentPost || !commentDraft.trim() || commentBusy) return;
    setCommentBusy(true);
    setCommentMessage('');
    try {
      await createPostComment({
        postId: commentPost.id,
        body: commentDraft,
        parentCommentId: replyTo?.id ?? null,
      });
      const updated = await getPostComments(commentPost.id);
      setComments(updated);
      setPosts(items => items.map(item => item.id === commentPost.id ? { ...item, commentCount: updated.length } : item));
      setCommentPost(current => current ? { ...current, commentCount: updated.length } : current);
      setCommentDraft('');
      setReplyTo(null);
    } catch (error) {
      setCommentMessage(error instanceof Error ? error.message : 'Could not publish your comment.');
    } finally {
      setCommentBusy(false);
    }
  }

  async function loadFeed() {
    setLoading(true);
    setMessage('');
    try {
      setPosts(await (feedMode === 'following' ? getHomeFeed() : getForYouFeed()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load your feed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFeed();
  }, [feedMode]);

  useEffect(() => {
    if (!sharedPostId) return;
    let active = true;
    (async () => {
      try {
        await loadFeed();
        const sharedPost = await getPostById(sharedPostId);
        if (!active) return;
        setPosts(items => [sharedPost, ...items.filter(item => item.id !== sharedPost.id)]);
        setMessage('Opened a post shared with you.');
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Could not open this shared post.');
      } finally {
        if (active) onSharedPostHandled();
      }
    })();
    return () => { active = false; };
  }, [sharedPostId]);

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

  async function repostPost(post: CreovaFeedPost) {
    if (postActionBusy) return;
    setPostActionBusy(post.id);
    try {
      await togglePostRepost(post.id);
      await loadFeed();
      setMessage(post.repostedByMe ? 'Repost removed.' : 'Post reposted to your feed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update your repost.');
    } finally {
      setPostActionBusy('');
    }
  }

  async function savePost(post: CreovaFeedPost) {
    if (postActionBusy) return;
    setPostActionBusy(post.id);
    try {
      const saved = await togglePostSave(post.id);
      setPosts(items => items.map(item => item.id === post.id ? { ...item, savedByMe: saved } : item));
      setMessage(saved ? 'Post saved privately.' : 'Post removed from your saved posts.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update saved posts.');
    } finally {
      setPostActionBusy('');
    }
  }

  async function sharePost(post: CreovaFeedPost) {
    if (postActionBusy) return;
    setPostActionBusy(post.id);
    try {
      const link = `creova://post/${post.id}`;
      const author = post.author?.display_name || 'A CREOVA creator';
      const handle = post.author?.username ? ` (@${post.author.username})` : '';
      const messageText = `${author}${handle} on CREOVA\\n\\n${post.caption || 'Check out this post.'}\\n\\nOpen in CREOVA: ${link}`;
      await Share.share({ message: messageText, url: link, title: 'Share CREOVA post' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open sharing options.');
    } finally {
      setPostActionBusy('');
    }
  }

  return (
    <View style={styles.screenContent}>
      <View style={[styles.feedHeading, { paddingVertical: 5, marginBottom: 5, gap: 8 }]}>
        {(['following', 'for-you'] as const).map(mode => {
          const active = feedMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              onPress={() => setFeedMode(mode)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: active ? COLORS.blue : 'transparent' }}
            >
              <Text style={{ color: active ? COLORS.text : COLORS.muted, fontSize: 14, fontWeight: active ? '800' : '600' }}>
                {mode === 'following' ? 'Following' : 'For You'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {!!message && <Text style={styles.notice}>{message}</Text>}
      {loading && <EmptyState title="Loading your feed" description="Finding the latest posts from your CREOVA network." />}
      {!loading && posts.length === 0 && <EmptyState
        title={feedMode === 'following' ? 'Your Following feed starts here' : 'Discover something new'}
        description={feedMode === 'following'
          ? 'Follow people or publish your first post. Their updates will appear here.'
          : 'Public posts from creators across CREOVA will appear here.'}
      />}
      {posts.map(post => (
        <View key={post.id} style={[styles.postCard, { marginHorizontal: -16 }]}>
          {!!post.repostedBy && <Text style={{ color: '#A7C6FF', fontSize: 11, fontWeight: '700', marginBottom: 9 }}>↻ {post.repostedBy.display_name || post.repostedBy.username} reposted</Text>}
          <View style={[styles.postHeader, { paddingHorizontal: 16, paddingTop: 4 }]}>
            <View style={styles.resultAvatar}>
              <Text style={styles.resultAvatarText}>{(post.author?.display_name || post.author?.username || 'C').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.postAuthor}>
              <Text style={styles.resultName}>{post.author?.display_name || 'CREOVA member'}</Text>
              <Text style={styles.resultHandle}>@{post.author?.username || 'member'} · {post.post_type} · {new Date(post.created_at).toLocaleDateString()}</Text>
            </View>
          </View>
          {post.media?.map(media => media.mediaType === 'video'
            ? <FeedVideo key={media.id} uri={media.signedUrl} />
            : <Image key={media.id} source={{ uri: media.signedUrl }} style={[styles.feedImage, { aspectRatio: 4 / 5 }]} resizeMode="cover" />)}
          {!!post.caption && <Text style={[styles.postCaption, { paddingHorizontal: 16 }]}>{post.caption}</Text>}
          <View style={[styles.postActions, { flexWrap: 'wrap', rowGap: 6, paddingHorizontal: 16, paddingBottom: 10 }]}>
            <TouchableOpacity disabled={busyPost === post.id || !!postActionBusy} onPress={() => likePost(post.id)} style={styles.postAction}>
              <Text style={[styles.postActionText, post.likedByMe && styles.postLiked]}>{post.likedByMe ? '♥' : '♡'} {post.likeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openComments(post)} style={styles.postAction} accessibilityRole="button" accessibilityLabel={`View ${post.commentCount} comments`}>
              <Text style={styles.postActionText}>▢ {post.commentCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!!postActionBusy} onPress={() => repostPost(post)} style={styles.postAction} accessibilityRole="button" accessibilityLabel={post.repostedByMe ? 'Remove repost' : 'Repost this post'}>
              <Text style={[styles.postActionText, post.repostedByMe && styles.postLiked]}>↻ {post.repostCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!!postActionBusy} onPress={() => sharePost(post)} style={styles.postAction} accessibilityRole="button" accessibilityLabel="Share this post">
              <Text style={styles.postActionText}>↗</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!!postActionBusy} onPress={() => savePost(post)} style={styles.postAction} accessibilityRole="button" accessibilityLabel={post.savedByMe ? 'Remove from saved posts' : 'Save this post'}>
              <Text style={[styles.postActionText, post.savedByMe && styles.postLiked]}>{post.savedByMe ? '▮' : '▯'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <Modal visible={!!commentPost} transparent animationType="slide" onRequestClose={() => setCommentPost(null)}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000B8' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ maxHeight: '86%', minHeight: '55%', backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: COLORS.border, padding: 18, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={styles.subheading}>Comments</Text>
                <Text style={styles.mutedSmall}>{commentPost?.commentCount ?? comments.length} CONVERSATION ENTRIES</Text>
              </View>
              <TouchableOpacity onPress={() => setCommentPost(null)} style={styles.refreshButton}><Text style={styles.refreshText}>Close</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 13, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
              {commentsLoading && <EmptyState title="Loading comments" description="Fetching the conversation for this post." />}
              {!commentsLoading && comments.length === 0 && <EmptyState title="Start the conversation" description="Be the first to comment on this post." />}
              {comments.map(comment => (
                <View key={comment.id} style={{ paddingLeft: comment.parent_comment_id ? 22 : 0, gap: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.resultAvatar}>
                      {comment.author?.avatar_url
                        ? <Image source={{ uri: comment.author.avatar_url }} style={styles.requestAvatarImage} />
                        : <Text style={styles.resultAvatarText}>{(comment.author?.display_name || comment.author?.username || 'C').slice(0, 1).toUpperCase()}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{comment.author?.display_name || 'CREOVA member'}</Text>
                      <Text style={styles.resultHandle}>@{comment.author?.username || 'member'} · {new Date(comment.created_at).toLocaleString()}</Text>
                    </View>
                  </View>
                  <Text style={{ color: COLORS.text, fontSize: 13, lineHeight: 20, paddingLeft: 50 }}>{comment.body}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 50, marginTop: 3 }}>
                    {(['like', 'love', 'laugh', 'wow', 'sad', 'angry'] as const).map(reaction => {
                      const summary = reactionSummaries[comment.id];
                      const emoji: Record<CommentReactionType, string> = { like: '👍', love: '❤️', laugh: '😂', wow: '😮', sad: '😢', angry: '😡' };
                      const selected = summary?.myReaction === reaction;
                      const count = summary?.counts[reaction] ?? 0;
                      return (
                        <TouchableOpacity
                          key={reaction}
                          disabled={reactionBusyId === comment.id}
                          onPress={() => handleCommentReaction(comment.id, reaction)}
                          accessibilityRole="button"
                          accessibilityLabel={`${reaction} reaction, ${count} total`}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 14, borderWidth: 1, borderColor: selected ? COLORS.blue : COLORS.border, backgroundColor: selected ? COLORS.accentSoft : COLORS.surface, paddingHorizontal: 7, paddingVertical: 4, opacity: reactionBusyId === comment.id ? 0.55 : 1 }}>
                          <Text style={{ fontSize: 12 }}>{emoji[reaction]}</Text>
                          {count > 0 && <Text style={{ color: selected ? '#A7C6FF' : COLORS.muted, fontSize: 10 }}>{count}</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity onPress={() => setReplyTo(comment)} style={{ alignSelf: 'flex-start', marginLeft: 50, paddingVertical: 3 }}>
                    <Text style={{ color: '#A7C6FF', fontSize: 10, fontWeight: '800' }}>Reply</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            {!!commentMessage && <Text style={styles.notice}>{commentMessage}</Text>}
            {replyTo && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceRaised, padding: 9, borderRadius: 9 }}>
              <Text style={styles.resultHandle}>Replying to @{replyTo.author?.username || 'member'}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}><Text style={{ color: '#A7C6FF', fontSize: 10 }}>Cancel reply</Text></TouchableOpacity>
            </View>}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                value={commentDraft}
                onChangeText={setCommentDraft}
                multiline
                maxLength={2000}
                placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
                placeholderTextColor="#71819C"
                style={{ flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 }}
              />
              <TouchableOpacity disabled={commentBusy || !commentDraft.trim()} onPress={submitComment} style={{ minHeight: 44, borderRadius: 11, paddingHorizontal: 15, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', opacity: commentBusy || !commentDraft.trim() ? 0.5 : 1 }}>
                <Text style={styles.publishButtonText}>{commentBusy ? '…' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function DiscoverScreen({ onOpenPost }: { onOpenPost: (postId: string) => void }) {
  const [mode, setMode] = useState<'posts' | 'people'>('posts');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<Awaited<ReturnType<typeof searchProfiles>>[number] & { followState: 'none' | 'requested' | 'following' }>>([]);
  const [posts, setPosts] = useState<CreovaFeedPost[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [postsBusy, setPostsBusy] = useState(true);
  const [busyFollowId, setBusyFollowId] = useState('');

  useEffect(() => {
    let active = true;
    getForYouFeed()
      .then(items => { if (active) setPosts(items); })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'Could not load Explore posts.'); })
      .finally(() => { if (active) setPostsBusy(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const term = query.trim();
    let active = true;
    if (mode !== 'people' || term.length < 2) {
      setResults([]);
      if (mode === 'people') { setMessage(''); setBusy(false); }
      return () => { active = false; };
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      setMessage('');
      try {
        const profiles = await searchProfiles(term);
        const states = await getFollowStates(profiles.map(item => item.id));
        if (active) setResults(profiles.map(item => ({ ...item, followState: states[item.id] ?? 'none' })));
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Search failed.');
      } finally {
        if (active) setBusy(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, mode]);

  async function toggleFollow(id: string) {
    const current = results.find(item => item.id === id);
    if (!current || busyFollowId) return;
    setBusyFollowId(id);
    try {
      if (current.followState === 'following' || current.followState === 'requested') {
        await unfollowProfile(id);
        setResults(items => items.map(item => item.id === id ? { ...item, followState: 'none' } : item));
      } else {
        const state = await followProfile(id);
        setResults(items => items.map(item => item.id === id ? { ...item, followState: state } : item));
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Follow action failed.'); }
    finally { setBusyFollowId(''); }
  }

  const term = query.trim().toLowerCase();
  const visiblePosts = posts.filter(post => !term || post.caption.toLowerCase().includes(term)
    || (post.author?.username ?? '').toLowerCase().includes(term)
    || (post.author?.display_name ?? '').toLowerCase().includes(term));

  return <View style={styles.screenContent}>
    <View style={styles.searchRow}>
      <TextInput value={query} onChangeText={setQuery} placeholder={mode === 'posts' ? 'Search posts and creators' : 'Search people on CREOVA'} placeholderTextColor="#71819C" style={styles.searchInput} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
    </View>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
      {(['posts', 'people'] as const).map(item => <TouchableOpacity key={item} onPress={() => { setMode(item); setMessage(''); }} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: mode === item ? COLORS.accentSoft : COLORS.surface, borderWidth: 1, borderColor: mode === item ? COLORS.blue : COLORS.border }}>
        <Text style={{ color: mode === item ? COLORS.text : COLORS.muted, fontWeight: '800', fontSize: 12 }}>{item === 'posts' ? 'Posts & videos' : 'People'}</Text>
      </TouchableOpacity>)}
    </View>
    {!!message && <Text style={styles.notice}>{message}</Text>}
    {mode === 'people' ? <>
      {busy && <Text style={styles.notice}>Searching…</Text>}
      {results.map(item => <View key={item.id} style={styles.resultRow}>
        <View style={styles.resultAvatar}><Text style={styles.resultAvatarText}>{(item.display_name || item.username).slice(0,1).toUpperCase()}</Text></View>
        <View style={styles.resultInfo}><Text style={styles.resultName}>{item.display_name}</Text><Text style={styles.resultHandle}>@{item.username}{item.is_private ? ' · Private' : ''}</Text></View>
        <TouchableOpacity onPress={() => toggleFollow(item.id)} disabled={busyFollowId === item.id} style={styles.followButton} accessibilityRole="button" accessibilityLabel={item.followState === 'following' ? 'Unfollow' : item.followState === 'requested' ? 'Cancel follow request' : 'Follow'}>
          <Text style={styles.followButtonText}>{busyFollowId === item.id ? '…' : item.followState === 'requested' ? 'Requested · Cancel' : item.followState === 'following' ? 'Following · Unfollow' : 'Follow'}</Text>
        </TouchableOpacity>
      </View>)}
      {query.trim().length < 2 && <EmptyState title="Find people to follow" description="Search by username to find creators and connect with them." />}
      {query.trim().length >= 2 && !busy && !message && results.length === 0 && <EmptyState title="No members found" description="Try another username." />}
    </> : <>
      {postsBusy && <Text style={styles.notice}>Loading posts and videos…</Text>}
      {!postsBusy && visiblePosts.length === 0 && <EmptyState title={term ? 'No matching posts' : 'Nothing to explore yet'} description={term ? 'Try another caption or creator name.' : 'Public posts and videos from creators will appear here.'} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
        {visiblePosts.map(post => {
          const media = post.media[0];
          return <TouchableOpacity key={post.id} onPress={() => onOpenPost(post.id)} activeOpacity={0.8} style={{ width: '32%', aspectRatio: 0.78, borderRadius: 9, overflow: 'hidden', backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border }}>
            {media?.mediaType === 'image' ? <Image source={{ uri: media.signedUrl }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
              : media?.mediaType === 'video' ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111D31' }}><Text style={{ color: COLORS.text, fontSize: 27 }}>▶</Text><Text style={{ color: COLORS.muted, fontSize: 9, marginTop: 4 }}>VIDEO</Text></View>
              : <View style={{ flex: 1, padding: 7, justifyContent: 'center' }}><Text numberOfLines={7} style={{ color: COLORS.text, fontSize: 11 }}>{post.caption || 'CREOVA post'}</Text></View>}
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.72)' }}>
              <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>@{post.author?.username ?? 'creator'}</Text>
              <Text style={{ color: '#D8E2F4', fontSize: 8 }}>♥ {post.likeCount}  ·  ▢ {post.commentCount}</Text>
            </View>
          </TouchableOpacity>;
        })}
      </View>
    </>}
  </View>;
}
function CreateScreen() {
  const [caption, setCaption] = useState('');
  const [postType, setPostType] = useState<'post' | 'anchor' | 'iteration'>('post');
  const [visibility, setVisibility] = useState<'public' | 'followers'>('public');
  const [selectedMedia, setSelectedMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');

  async function chooseMedia() {
    setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.85,
      });
      if (!result.canceled && result.assets.length) {
        const assets = result.assets.slice(0, 10);
        for (const asset of assets) {
          const isVideo = asset.type === 'video';
          const mimeType = (asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg')).toLowerCase();
          const maxBytes = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
          const allowed = isVideo
            ? ['video/mp4', 'video/quicktime', 'video/webm']
            : ['image/jpeg', 'image/png', 'image/webp'];
          if (!allowed.includes(mimeType)) {
            setNotice(isVideo ? 'Use MP4, MOV, or WebM videos.' : 'Use JPEG, PNG, or WebP photos.');
            return;
          }
          if (asset.fileSize != null && asset.fileSize > maxBytes) {
            setNotice(isVideo ? 'Each video must be smaller than 50 MB.' : 'Each photo must be smaller than 10 MB.');
            return;
          }
          if (isVideo && asset.duration != null && asset.duration > 180_000) {
            setNotice('Feed videos must be 3 minutes or shorter.');
            return;
          }
        }
        setSelectedMedia(assets);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not open your media library.');
    }
  }

  async function publish() {
    if (!caption.trim() && selectedMedia.length === 0) {
      setNotice('Write a caption or choose a photo/video first.');
      return;
    }
    setPublishing(true);
    setNotice('');
    try {
      if (selectedMedia.length) {
        await createPostWithMedia({
          caption,
          postType,
          visibility,
          media: selectedMedia.map(asset => ({
            uri: asset.uri,
            mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
            fileSize: asset.fileSize ?? null,
            width: asset.width,
            height: asset.height,
            mediaType: asset.type === 'video' ? 'video' : 'image',
            durationSeconds: asset.type === 'video' && asset.duration != null ? asset.duration / 1000 : null,
          })),
        });
      } else {
        await createPost({ caption, postType, visibility });
      }
      setCaption('');
      setSelectedMedia([]);
      setNotice('Published. Your post is now in your CREOVA feed.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not publish your post.');
    } finally {
      setPublishing(false);
    }
  }

  return <View style={styles.screenContent}>
    <View style={styles.composerCard}>
      <Text style={styles.composerTitle}>Create a post</Text>
      <Text style={styles.composerHint}>Write something or add up to 10 photos/videos. Photos: 10 MB max. Videos: 50 MB and 3 minutes max.</Text>
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
      <TouchableOpacity onPress={chooseMedia} disabled={publishing} style={styles.imagePickButton}>
        <Text style={styles.imagePickButtonText}>{selectedMedia.length ? '＋ Add or replace media' : '＋ Add photos or videos (up to 10)'}</Text>
      </TouchableOpacity>
      {selectedMedia.length > 0 && <Text style={styles.composerCount}>{selectedMedia.length}/10 media items selected · Order follows your selection</Text>}
      {selectedMedia.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
        {selectedMedia.map((asset, index) => <View key={asset.assetId ?? asset.uri} style={{ width: 132, gap: 6 }}>
          <View style={{ position: 'relative' }}>
            {asset.type === 'video'
              ? <View style={{ width: 132, height: 132, borderRadius: 12, backgroundColor: '#192840', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 30 }}>▶</Text><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>VIDEO</Text></View>
              : <Image source={{ uri: asset.uri }} style={{ width: 132, height: 132, borderRadius: 12 }} resizeMode="cover" />}
            <View style={{ position: 'absolute', left: 7, top: 7, backgroundColor: '#090D18CC', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{index + 1}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setSelectedMedia(items => items.filter((_, itemIndex) => itemIndex !== index))} style={styles.removeImageButton}>
            <Text style={styles.removeImageText}>Remove</Text>
          </TouchableOpacity>
        </View>)}
      </ScrollView>}
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
      <TouchableOpacity disabled={publishing || (!caption.trim() && selectedMedia.length === 0)} onPress={publish} style={[styles.publishButton, (publishing || (!caption.trim() && selectedMedia.length === 0)) && styles.publishButtonDisabled]}>
        <Text style={styles.publishButtonText}>{publishing ? 'Publishing…' : 'Publish post'}</Text>
      </TouchableOpacity>
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
    </View>
  </View>;
}

function MessageVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => { instance.loop = false; });
  return <VideoView player={player} style={{ width: 230, height: 180, borderRadius: 10 }} contentFit="contain" nativeControls />;
}

function MessageAudio({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  return (
    <TouchableOpacity onPress={() => player.play()} style={{ minWidth: 190, padding: 12, borderRadius: 12, backgroundColor: '#0D2445', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 18 }}>▶</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Play voice note</Text>
    </TouchableOpacity>
  );
}

function InboxScreen({ onOpenPost }: { onOpenPost: (postId: string) => void }) {
  const voiceRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [section, setSection] = useState<'Messages' | 'Notifications'>('Messages');
  const [messageSection, setMessageSection] = useState<'Chats' | 'Requests'>('Chats');
  const [notificationSection, setNotificationSection] = useState<'Activity' | 'Follow requests'>('Activity');
  const [notifications, setNotifications] = useState<CreovaNotification[]>([]);
  const [followRequests, setFollowRequests] = useState<Awaited<ReturnType<typeof getIncomingFollowRequests>>>([]);
  const [conversations, setConversations] = useState<CreovaConversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [activeConversation, setActiveConversation] = useState<CreovaConversation | null>(null);
  const [threadMessages, setThreadMessages] = useState<CreovaMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
  const [draft, setDraft] = useState('');
  const [draftClientId, setDraftClientId] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachmentInput | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchProfiles>>>([]);
  const [suggestedPeople, setSuggestedPeople] = useState<Awaited<ReturnType<typeof searchProfiles>>>([]);
  const [selectedPeople, setSelectedPeople] = useState<Awaited<ReturnType<typeof searchProfiles>>>([]);
  const [groupTitle, setGroupTitle] = useState('');

  async function loadMessaging() {
    try {
      const [userId, items] = await Promise.all([getCurrentMessagingUserId(), getMyConversations()]);
      setCurrentUserId(userId);
      setConversations(items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load your messages.');
    } finally {
      setLoading(false);
    }
  }

  async function loadActivity() {
    try { setNotifications(await getNotifications()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load your activity.'); }
  }

  async function loadFollowRequests() {
    try { setFollowRequests(await getIncomingFollowRequests()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load follow requests.'); }
  }

  useEffect(() => {
    void loadMessaging();
    void loadActivity();
    void loadFollowRequests();
  }, []);

  useEffect(() => subscribeToInboxChanges(
    () => { void loadMessaging(); },
    () => { void loadMessaging(); void loadFollowRequests(); },
    () => { void loadActivity(); void loadFollowRequests(); },
  ), []);

  async function refreshInbox() {
    setRefreshing(true);
    setMessage('');
    try {
      await Promise.all([loadMessaging(), loadActivity(), loadFollowRequests()]);
    } finally {
      setRefreshing(false);
    }
  }

  async function openConversation(item: CreovaConversation) {
    setActiveConversation(item);
    setThreadMessages([]);
    setDraft('');
    setDraftClientId(null);
    setPendingAttachment(null);
    setThreadLoading(true);
    setConnectionStatus('CONNECTING');
    try {
      const messages = await getConversationMessages(item.id);
      setThreadMessages(messages);
      await markConversationRead(item.id);
      await loadMessaging();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open this conversation.');
    } finally {
      setThreadLoading(false);
    }
  }

  useEffect(() => {
    if (!activeConversation) return;
    const conversationId = activeConversation.id;
    const unsubscribe = subscribeToConversationMessages(conversationId, () => {
      void getConversationMessages(conversationId).then(setThreadMessages).catch(error => {
        setMessage(error instanceof Error ? error.message : 'Could not refresh messages.');
      });
      void loadMessaging();
      void markConversationRead(conversationId);
    }, setConnectionStatus);
    return unsubscribe;
  }, [activeConversation?.id]);

  useEffect(() => {
    if (!newChatOpen) return;
    const recentPeople = conversations
      .flatMap(item => item.participants)
      .filter(person => person.user_id !== currentUserId && person.membership_status === 'accepted' && person.profile)
      .reduce((unique, person) => {
        if (!unique.some(item => item.id === person.user_id)) unique.push({
          id: person.user_id,
          username: person.profile!.username,
          display_name: person.profile!.display_name,
          avatar_url: person.profile!.avatar_url,
          is_private: false,
        });
        return unique;
      }, [] as Awaited<ReturnType<typeof searchProfiles>>);
    setSuggestedPeople(recentPeople.slice(0, 8));
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchProfiles(query).then(results => {
        if (!cancelled) setSearchResults(results.filter(profile => profile.id !== currentUserId));
      }).catch(error => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Could not search people.');
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, newChatOpen, currentUserId]);

  async function startConversation() {
    if (!selectedPeople.length || busyId) return;
    setBusyId('new-chat');
    setMessage('');
    try {
      const kind = selectedPeople.length === 1 ? 'direct' : 'group';
      const id = await createConversation({
        kind,
        memberIds: [currentUserId, ...selectedPeople.map(person => person.id)],
        title: kind === 'group' ? groupTitle : undefined,
      });
      setNewChatOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPeople([]);
      setGroupTitle('');
      await loadMessaging();
      const items = await getMyConversations();
      const conversation = items.find(item => item.id === id);
      if (conversation) await openConversation(conversation);
      else setMessage('Conversation created. Refresh your inbox to open it.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start this conversation.');
    } finally {
      setBusyId('');
    }
  }

  function togglePerson(person: (typeof searchResults)[number]) {
    setSelectedPeople(items => items.some(item => item.id === person.id)
      ? items.filter(item => item.id !== person.id)
      : [...items, person]);
  }

  async function chooseChatAttachment() {
    if (busyId || !activeConversation) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage('Allow photo-library access to attach a photo or video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      const kind = asset.type === 'video' ? 'video' : 'image';
      if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'].includes(mimeType)) {
        setMessage('Choose a JPEG, PNG, WebP, MP4, MOV or WebM file.');
        return;
      }
      if (asset.fileSize != null && asset.fileSize > 25 * 1024 * 1024) {
        setMessage('Chat attachments must be 25 MB or smaller.');
        return;
      }
      if (kind === 'video' && asset.duration != null && asset.duration > 120000) {
        setMessage('Chat videos must be 2 minutes or shorter.');
        return;
      }
      setPendingAttachment({
        uri: asset.uri,
        kind,
        fileName: asset.fileName || (kind === 'video' ? 'video.mp4' : 'photo.jpg'),
        mimeType,
        fileSize: asset.fileSize ?? 1,
        durationMs: asset.duration ?? null,
      });
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not choose this attachment.');
    }
  }

  async function startVoiceRecording() {
    if (busyId || recordingVoice || !activeConversation) return;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setMessage('Allow microphone access to record a voice note.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await voiceRecorder.prepareToRecordAsync();
      voiceRecorder.record({ forDuration: 120 });
      setRecordingVoice(true);
      setMessage('Recording voice note… tap Stop when finished (maximum 2 minutes).');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start voice recording.');
    }
  }

  async function stopVoiceRecording() {
    if (!recordingVoice) return;
    try {
      await voiceRecorder.stop();
      const status = voiceRecorder.getStatus();
      const uri = voiceRecorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setRecordingVoice(false);
      if (!uri) throw new Error('The voice recording was not saved. Please try again.');
      if (status.durationMillis > 120000) throw new Error('Voice notes must be 2 minutes or shorter.');
      setPendingAttachment({
        uri,
        kind: 'audio',
        fileName: 'voice-note.m4a',
        mimeType: 'audio/mp4',
        fileSize: Math.max(1, status.fileSize ?? 1),
        durationMs: Math.max(1, status.durationMillis),
      });
      setMessage('Voice note ready. Send it when you are ready.');
    } catch (error) {
      setRecordingVoice(false);
      setMessage(error instanceof Error ? error.message : 'Could not finish the voice note.');
    }
  }

  async function submitMessage() {
    if (!activeConversation || (!draft.trim() && !pendingAttachment) || busyId || recordingVoice) return;
    setBusyId('send');
    setMessage('');
    try {
      const clientMessageId = draftClientId ?? createMessageClientId();
      setDraftClientId(clientMessageId);
      const sent = await sendMessage(activeConversation.id, draft, clientMessageId, pendingAttachment ?? undefined);
      setThreadMessages(items => items.some(item => item.id === sent.id) ? items : [...items, sent]);
      setDraft('');
      setPendingAttachment(null);
      setDraftClientId(null);
      await loadMessaging();
      const updated = (await getMyConversations()).find(item => item.id === activeConversation.id);
      if (updated) setActiveConversation(updated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Message could not be sent. Check your connection and retry.');
    } finally {
      setBusyId('');
    }
  }

  async function answerMessageRequest(accept: boolean) {
    if (!activeConversation || busyId) return;
    setBusyId('request');
    setMessage('');
    try {
      await respondToMessageRequest(activeConversation.id, accept);
      await loadMessaging();
      if (accept) {
        const updated = (await getMyConversations()).find(item => item.id === activeConversation.id);
        if (updated) setActiveConversation(updated);
        await markConversationRead(activeConversation.id);
      } else {
        setActiveConversation(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this request.');
    } finally {
      setBusyId('');
    }
  }

  async function markAllRead() {
    if (busyId) return;
    setBusyId('all');
    setMessage('');
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications(items => items.map(item => item.read_at ? item : { ...item, read_at: now }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not mark activity as read.');
    } finally {
      setBusyId('');
    }
  }

  async function openNotification(item: CreovaNotification) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      if (!item.read_at) {
        await markNotificationRead(item.id);
        setNotifications(items => items.map(value => value.id === item.id ? { ...value, read_at: new Date().toISOString() } : value));
      }
      if (item.post_id) onOpenPost(item.post_id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open this activity.');
    } finally {
      setBusyId('');
    }
  }

  async function respondToFollow(followerId: string, accept: boolean) {
    if (busyId) return;
    setBusyId(followerId);
    setMessage('');
    try {
      await respondToFollowRequest(followerId, accept);
      setFollowRequests(items => items.filter(item => item.follower_id !== followerId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this follow request.');
    } finally {
      setBusyId('');
    }
  }

  function conversationTitle(item: CreovaConversation) {
    if (item.kind === 'group') return item.title || 'Group chat';
    const other = item.participants.find(person => person.user_id !== currentUserId);
    return other?.profile?.display_name || other?.profile?.username || 'CREOVA member';
  }

  function conversationSubtitle(item: CreovaConversation) {
    if (item.kind === 'group') {
      const accepted = item.participants.filter(person => person.membership_status === 'accepted').length;
      return `${accepted} member${accepted === 1 ? '' : 's'} active`;
    }
    const other = item.participants.find(person => person.user_id !== currentUserId);
    return other?.profile?.username ? `@${other.profile.username}` : 'Direct conversation';
  }

  const notificationText: Record<CreovaNotification['notification_type'], string> = {
    follow_request: 'requested to follow you',
    new_follower: 'started following you',
    follow_accepted: 'accepted your follow request',
    post_like: 'liked your post',
    post_comment: 'commented on your post',
    comment_reply: 'replied to a comment',
    post_repost: 'reposted your post',
  };
  const unreadNotifications = notifications.filter(item => !item.read_at).length;
  const unreadMessages = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  const activeConversations = conversations.filter(item => item.membershipStatus === 'accepted');
  const incomingRequests = conversations.filter(item => item.membershipStatus === 'pending');
  const pendingOthers = activeConversation?.participants.some(person =>
    person.user_id !== currentUserId && person.membership_status === 'pending'
  ) ?? false;
  const declinedOthers = activeConversation?.kind === 'direct' && (activeConversation.participants.some(person =>
    person.user_id !== currentUserId && person.membership_status === 'declined'
  ) ?? false);
  const canCompose = !!activeConversation
    && activeConversation.membershipStatus === 'accepted'
    && !declinedOthers
    && (!pendingOthers || !activeConversation.lastMessage);
  const waitingForReply = !!activeConversation && activeConversation.membershipStatus === 'accepted'
    && !declinedOthers && pendingOthers && !!activeConversation.lastMessage;

  return <View style={{ flex: 1, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View>
        <Text style={styles.eyebrow}>YOUR CONNECTIONS</Text>
        <Text style={styles.heading}>Inbox</Text>
      </View>
      {section === 'Messages' && <TouchableOpacity onPress={() => setNewChatOpen(true)} style={styles.searchButton}>
        <Text style={styles.searchButtonText}>+ New message</Text>
      </TouchableOpacity>}
    </View>
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
      {(['Messages', 'Notifications'] as const).map(value => (
        <TouchableOpacity key={value} onPress={() => setSection(value)} style={{ paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 2, borderBottomColor: section === value ? COLORS.blue : 'transparent' }}>
          <Text style={{ color: section === value ? COLORS.text : COLORS.muted, fontSize: 13, fontWeight: '800' }}>
            {value}{value === 'Messages' && unreadMessages > 0 ? ` · ${unreadMessages}` : ''}{value === 'Notifications' && unreadNotifications > 0 ? ` · ${unreadNotifications}` : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
    {!!message && <Text style={styles.notice}>{message}</Text>}
    {section === 'Messages' ? <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        {(['Chats', 'Requests'] as const).map(value => (
          <TouchableOpacity key={value} onPress={() => setMessageSection(value)} style={{ paddingVertical: 7, borderBottomWidth: 2, borderBottomColor: messageSection === value ? COLORS.blue : 'transparent' }}>
            <Text style={{ color: messageSection === value ? COLORS.text : COLORS.muted, fontSize: 12, fontWeight: '800' }}>
              {value}{value === 'Requests' && incomingRequests.length > 0 ? ` · ${incomingRequests.length}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={styles.mutedSmall}>{connectionStatus === 'SUBSCRIBED' ? 'LIVE CHAT' : 'MESSAGES'}</Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 22 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshInbox} tintColor={COLORS.blue} colors={[COLORS.blue]} />}
      >
        {loading && <EmptyState title="Loading your inbox" description="Fetching conversations and message requests." />}
        {!loading && messageSection === 'Chats' && activeConversations.length === 0 && <EmptyState title="Your conversations start here" description="Start a private chat or create a group with people on CREOVA." />}
        {!loading && messageSection === 'Requests' && incomingRequests.length === 0 && <EmptyState title="No message requests" description="New conversation requests will appear here for you to review." />}
        {!loading && (messageSection === 'Chats' ? activeConversations : incomingRequests).map(item => {
          const avatar = item.kind === 'group'
            ? item.participants.find(person => person.user_id !== currentUserId)?.profile?.avatar_url
            : item.participants.find(person => person.user_id !== currentUserId)?.profile?.avatar_url;
          const preview = item.lastMessage?.body
            || (item.lastMessage?.attachment_type === 'image' ? '📷 Photo' : item.lastMessage?.attachment_type === 'video' ? '▶ Video' : item.lastMessage?.attachment_type === 'audio' ? '🎤 Voice note' : null)
            || (item.membershipStatus === 'pending' ? 'Message request · Review before replying' : item.participants.some(person => person.membership_status === 'pending') ? 'Waiting for people to accept' : 'No messages yet');
          return <TouchableOpacity key={item.id} onPress={() => void openConversation(item)} style={[styles.requestCard, { backgroundColor: item.unreadCount ? '#101827' : COLORS.surface, borderColor: item.unreadCount ? '#355B9C' : COLORS.border }]}>
            <View style={styles.resultAvatar}>
              {avatar ? <Image source={{ uri: avatar }} style={styles.requestAvatarImage} /> : <Text style={styles.resultAvatarText}>{conversationTitle(item).slice(0, 1).toUpperCase()}</Text>}
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>{conversationTitle(item)}</Text>
              <Text style={styles.resultHandle}>{conversationSubtitle(item)}</Text>
              <Text numberOfLines={1} style={{ color: item.unreadCount ? COLORS.text : COLORS.muted, fontSize: 11, marginTop: 2 }}>{preview}</Text>
            </View>
            {item.unreadCount > 0 && <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
            </View>}
          </TouchableOpacity>;
        })}
      </ScrollView>
    </> : <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        {(['Activity', 'Follow requests'] as const).map(value => (
          <TouchableOpacity key={value} onPress={() => setNotificationSection(value)} style={{ paddingVertical: 7, borderBottomWidth: 2, borderBottomColor: notificationSection === value ? COLORS.blue : 'transparent' }}>
            <Text style={{ color: notificationSection === value ? COLORS.text : COLORS.muted, fontSize: 12, fontWeight: '800' }}>
              {value}{value === 'Activity' && unreadNotifications > 0 ? ` · ${unreadNotifications}` : ''}{value === 'Follow requests' && followRequests.length > 0 ? ` · ${followRequests.length}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {notificationSection === 'Activity' && unreadNotifications > 0 && <TouchableOpacity disabled={busyId === 'all'} onPress={() => void markAllRead()}>
          <Text style={{ color: '#A7C6FF', fontSize: 10, fontWeight: '800' }}>Mark all read</Text>
        </TouchableOpacity>}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 22 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshInbox} tintColor={COLORS.blue} colors={[COLORS.blue]} />}
      >
        {notificationSection === 'Activity' && notifications.length === 0 && <EmptyState title="Your activity starts here" description="Likes, comments, mentions, reposts and follow activity will appear here." />}
        {notificationSection === 'Activity' && notifications.map(item => (
          <TouchableOpacity key={item.id} disabled={!!busyId} onPress={() => void openNotification(item)} style={[styles.requestCard, { backgroundColor: item.read_at ? 'transparent' : '#101827', borderColor: 'transparent', opacity: busyId === item.id ? 0.6 : 1 }]}>
            <View style={styles.resultAvatar}>
              {item.actor?.avatar_url ? <Image source={{ uri: item.actor.avatar_url }} style={styles.requestAvatarImage} /> : <Text style={styles.resultAvatarText}>{(item.actor?.display_name || item.actor?.username || 'C').slice(0, 1).toUpperCase()}</Text>}
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>{item.actor?.display_name || item.actor?.username || 'CREOVA member'} <Text style={{ color: COLORS.muted, fontWeight: '400' }}>{notificationText[item.notification_type]}</Text></Text>
              <Text style={styles.resultHandle}>@{item.actor?.username || 'member'} · {new Date(item.created_at).toLocaleString()}</Text>
            </View>
            {!item.read_at && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.blue }} />}
          </TouchableOpacity>
        ))}
        {notificationSection === 'Activity' && notifications.length === 0 && <Text style={styles.notice}>You’re all caught up.</Text>}
        {notificationSection === 'Follow requests' && followRequests.length === 0 && <EmptyState title="You're all caught up" description="New follow requests will appear here." />}
        {notificationSection === 'Follow requests' && followRequests.map(item => <View key={item.follower_id} style={styles.requestCard}>
          <View style={styles.resultAvatar}>
            {item.follower.avatar_url ? <Image source={{ uri: item.follower.avatar_url }} style={styles.requestAvatarImage} /> : <Text style={styles.resultAvatarText}>{(item.follower.display_name || item.follower.username || 'C').slice(0, 1).toUpperCase()}</Text>}
          </View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultName}>{item.follower.display_name || item.follower.username}</Text>
            <Text style={styles.resultHandle}>@{item.follower.username} · {new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          <View style={styles.requestActions}>
            <TouchableOpacity disabled={!!busyId} onPress={() => void respondToFollow(item.follower_id, true)} style={styles.acceptRequestButton}><Text style={styles.acceptRequestText}>{busyId === item.follower_id ? '…' : 'Accept'}</Text></TouchableOpacity>
            <TouchableOpacity disabled={!!busyId} onPress={() => void respondToFollow(item.follower_id, false)} style={styles.declineRequestButton}><Text style={styles.declineRequestText}>Decline</Text></TouchableOpacity>
          </View>
        </View>)}
      </ScrollView>
    </>}
    <Modal visible={newChatOpen} animationType="slide" onRequestClose={() => setNewChatOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: Platform.OS === 'android' ? 30 : 55, paddingHorizontal: 16, paddingBottom: 22, gap: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.heading}>New conversation</Text>
          <TouchableOpacity onPress={() => setNewChatOpen(false)}><Text style={{ color: COLORS.text, fontSize: 26 }}>×</Text></TouchableOpacity>
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, paddingHorizontal: 10 }}>
            <Text style={{ color: COLORS.muted, fontSize: 12, fontWeight: '800' }}>To:</Text>
            <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
              {selectedPeople.map(person => <TouchableOpacity key={person.id} onPress={() => togglePerson(person)} style={{ backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.blue, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: '#A7C6FF', fontSize: 11, fontWeight: '700' }}>@{person.username} ×</Text>
              </TouchableOpacity>)}
            </ScrollView>
          </View>
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search name or username…" placeholderTextColor="#71819C" style={[styles.searchInput, { minHeight: 46, maxHeight: 48 }]} autoCapitalize="none" multiline={false} />
        </View>
        {selectedPeople.length > 1 && <TextInput value={groupTitle} onChangeText={setGroupTitle} maxLength={80} placeholder="Group name (optional)" placeholderTextColor="#71819C" style={styles.searchInput} />}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 7 }}>
          {searchQuery.trim().length < 2 && <Text style={styles.editLabel}>SUGGESTED · RECENT CONVERSATIONS</Text>}
          {searchQuery.trim().length < 2 && suggestedPeople.length === 0 && <EmptyState title="Find people on CREOVA" description="Search a name or username to discover someone and start a conversation." />}
          {searchQuery.trim().length >= 2 && !searchResults.length && <EmptyState title="No matches found" description="Check the spelling or try another name or username." />}
          {(searchQuery.trim().length < 2 ? suggestedPeople : searchResults).map(person => {
            const selected = selectedPeople.some(item => item.id === person.id);
            return <TouchableOpacity key={person.id} onPress={() => togglePerson(person)} style={[styles.resultRow, { borderColor: selected ? COLORS.blue : COLORS.border, backgroundColor: selected ? COLORS.accentSoft : COLORS.surface }]}>
              <View style={styles.resultAvatar}>
                {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.requestAvatarImage} /> : <Text style={styles.resultAvatarText}>{person.display_name.slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{person.display_name}</Text>
                <Text style={styles.resultHandle}>@{person.username}{person.is_private ? ' · Private' : ''}</Text>
              </View>
              <Text style={{ color: selected ? '#A7C6FF' : COLORS.muted, fontWeight: '900' }}>{selected ? '✓' : '+'}</Text>
            </TouchableOpacity>;
          })}
        </ScrollView>
        <TouchableOpacity disabled={!selectedPeople.length || busyId === 'new-chat'} onPress={() => void startConversation()} style={[styles.publishButton, (!selectedPeople.length || busyId === 'new-chat') && styles.publishButtonDisabled]}>
          <Text style={styles.publishButtonText}>{busyId === 'new-chat' ? 'Starting…' : selectedPeople.length > 1 ? 'Next · Create group' : selectedPeople.length === 1 ? 'Next · Private chat' : 'Select a recipient'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={!!activeConversation} animationType="slide" onRequestClose={() => setActiveConversation(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: Platform.OS === 'android' ? 28 : 48 }}>
        <View style={{ minHeight: 58, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => { setActiveConversation(null); void loadMessaging(); }}><Text style={{ color: '#A7C6FF', fontSize: 25 }}>‹</Text></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultName}>{activeConversation ? conversationTitle(activeConversation) : 'Conversation'}</Text>
            <Text style={styles.resultHandle}>{activeConversation ? conversationSubtitle(activeConversation) : ''} · {connectionStatus === 'SUBSCRIBED' ? 'Live' : connectionStatus === 'CHANNEL_ERROR' || connectionStatus === 'TIMED_OUT' ? 'Reconnecting' : 'Connecting'}</Text>
          </View>
        </View>
        {activeConversation?.membershipStatus === 'pending' && <View style={{ backgroundColor: COLORS.surface, padding: 14, gap: 8 }}>
          <Text style={styles.resultName}>Message request</Text>
          <Text style={styles.notice}>Accept this request to continue the conversation, or decline it to remove it from your requests.</Text>
          <View style={styles.requestActions}>
            <TouchableOpacity disabled={busyId === 'request'} onPress={() => void answerMessageRequest(true)} style={styles.acceptRequestButton}><Text style={styles.acceptRequestText}>Accept</Text></TouchableOpacity>
            <TouchableOpacity disabled={busyId === 'request'} onPress={() => void answerMessageRequest(false)} style={styles.declineRequestButton}><Text style={styles.declineRequestText}>Decline</Text></TouchableOpacity>
          </View>
        </View>}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 9, flexGrow: 1, justifyContent: 'flex-end' }} refreshControl={<RefreshControl refreshing={threadLoading} onRefresh={() => { if (!activeConversation) return; setThreadLoading(true); void getConversationMessages(activeConversation.id).then(setThreadMessages).catch(error => setMessage(error instanceof Error ? error.message : 'Could not refresh messages.')).finally(() => setThreadLoading(false)); }} tintColor={COLORS.blue} colors={[COLORS.blue]} />}>
          {threadLoading && <EmptyState title="Loading conversation" description="Recovering the latest messages." />}
          {!threadLoading && !threadMessages.length && <EmptyState title="Say hello" description="This conversation is ready. Send the first message to begin." />}
          {threadMessages.map(item => {
            const mine = item.sender_id === currentUserId;
            return <View key={item.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', backgroundColor: mine ? '#173B70' : COLORS.surfaceRaised, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10, gap: 5 }}>
              {!mine && <Text style={{ color: '#A7C6FF', fontSize: 9, fontWeight: '800' }}>{item.sender?.display_name || item.sender?.username || 'CREOVA member'}</Text>}
              {!!item.body && <Text style={{ color: COLORS.text, fontSize: 13, lineHeight: 19 }}>{item.body}</Text>}
              {!!item.attachmentUrl && item.attachment_type === 'image' && <Image source={{ uri: item.attachmentUrl }} style={{ width: 230, height: 210, borderRadius: 10 }} resizeMode="cover" />}
              {!!item.attachmentUrl && item.attachment_type === 'video' && <MessageVideo uri={item.attachmentUrl} />}
              {!!item.attachmentUrl && item.attachment_type === 'audio' && <MessageAudio uri={item.attachmentUrl} />}
              {!!item.attachment_path && !item.attachmentUrl && <Text style={{ color: COLORS.muted, fontSize: 11 }}>Attachment unavailable. Refresh to try again.</Text>}
              <Text style={{ color: '#A8B6CC', fontSize: 9, textAlign: 'right' }}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>;
          })}
        </ScrollView>
        {declinedOthers && <Text style={[styles.notice, { padding: 13 }]}>One or more invited participants declined this conversation. Sending is paused.</Text>}
        {waitingForReply && <Text style={[styles.notice, { padding: 13 }]}>Your message request has been sent. You can continue once the other participant accepts.</Text>}
        {activeConversation?.membershipStatus === 'accepted' && !canCompose && !waitingForReply && <Text style={[styles.notice, { padding: 13 }]}>This conversation is waiting for the invited participants to accept.</Text>}
        {canCompose && <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 }}>
          {!!pendingAttachment && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceRaised, borderRadius: 10, padding: 9 }}>
            <Text style={{ color: COLORS.text, fontSize: 11, flex: 1 }} numberOfLines={1}>Ready: {pendingAttachment.kind === 'audio' ? 'Voice note' : pendingAttachment.fileName}</Text>
            <TouchableOpacity onPress={() => setPendingAttachment(null)}><Text style={{ color: '#FF9B9B', fontWeight: '800', paddingHorizontal: 8 }}>Remove</Text></TouchableOpacity>
          </View>}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}>
            <TouchableOpacity disabled={!!busyId || recordingVoice} onPress={() => void chooseChatAttachment()} style={{ width: 40, height: 44, borderRadius: 20, backgroundColor: COLORS.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: COLORS.text, fontSize: 21 }}>＋</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={!!busyId || !!pendingAttachment} onPress={() => void (recordingVoice ? stopVoiceRecording() : startVoiceRecording())} style={{ width: 40, height: 44, borderRadius: 20, backgroundColor: recordingVoice ? '#8B2635' : COLORS.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: COLORS.text, fontSize: 17 }}>{recordingVoice ? '■' : '●'}</Text>
            </TouchableOpacity>
            <TextInput value={draft} onChangeText={value => { if (value !== draft) setDraftClientId(null); setDraft(value); }} multiline maxLength={5000} placeholder="Write a message…" placeholderTextColor="#71819C" style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, color: COLORS.text, paddingHorizontal: 15, paddingVertical: 11, fontSize: 13 }} />
            <TouchableOpacity disabled={(!draft.trim() && !pendingAttachment) || busyId === 'send' || recordingVoice} onPress={() => void submitMessage()} style={{ minHeight: 44, borderRadius: 22, paddingHorizontal: 14, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', opacity: (!draft.trim() && !pendingAttachment) || busyId === 'send' || recordingVoice ? 0.5 : 1 }}>
              <Text style={styles.publishButtonText}>{busyId === 'send' ? '…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
          {recordingVoice && <Text style={{ color: '#FF9B9B', fontSize: 11 }}>Recording… tap the red stop button to finish.</Text>}
        </View>}
        {!!message && <Text style={[styles.notice, { paddingHorizontal: 13, paddingBottom: 8 }]}>{message}</Text>}
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
function StoriesSection() {
  const [stories, setStories] = useState<CreovaStory[]>([]);
  const [storyMessage, setStoryMessage] = useState('');
  const [storyBusy, setStoryBusy] = useState(false);
  const [selectedStoryAsset, setSelectedStoryAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [storyCaptionDraft, setStoryCaptionDraft] = useState('');
  const [activeStoryOwnerId, setActiveStoryOwnerId] = useState<string | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyReplyDraft, setStoryReplyDraft] = useState('');
  const [storyViewers, setStoryViewers] = useState<Awaited<ReturnType<typeof getMyStoryViewers>>>([]);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const activeStoryGroup = activeStoryOwnerId
    ? stories.filter(item => item.user_id === activeStoryOwnerId)
    : [];
  const activeStory = activeStoryGroup[activeStoryIndex] ?? null;
  const storyGroups = Array.from(new Map(stories.map(item => [item.user_id, item])).values())
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

  async function refreshStories() {
    try {
      setStories(await getActiveStories());
      setStoryMessage('');
    } catch (error) {
      setStoryMessage(error instanceof Error ? error.message : 'Could not load stories.');
    }
  }

  async function chooseStory() {
    if (storyBusy || selectedStoryAsset) return;
    setStoryMessage('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStoryMessage('Allow photo-library access to add a story.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: false,
        quality: 0.9,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      if (asset.fileSize != null && asset.fileSize > 50 * 1024 * 1024) {
        setStoryMessage('Stories must be 50 MB or smaller.');
        return;
      }
      if (asset.duration != null && asset.duration > 60_000) {
        setStoryMessage('Story videos must be 60 seconds or shorter.');
        return;
      }
      setSelectedStoryAsset(asset);
      setStoryCaptionDraft('');
    } catch (error) {
      setStoryMessage(error instanceof Error ? error.message : 'Could not open your media library.');
    }
  }

  async function publishSelectedStory() {
    if (!selectedStoryAsset || storyBusy) return;
    setStoryBusy(true);
    setStoryMessage('');
    try {
      const asset = selectedStoryAsset;
      await publishStory({
        media: {
          uri: asset.uri,
          mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          fileSize: asset.fileSize ?? null,
        },
        caption: storyCaptionDraft,
        visibility: 'followers',
      });
      setSelectedStoryAsset(null);
      setStoryCaptionDraft('');
      await refreshStories();
      setStoryMessage('Your story is live for 24 hours.');
    } catch (error) {
      setStoryMessage(error instanceof Error ? error.message : 'Could not publish your story.');
    } finally {
      setStoryBusy(false);
    }
  }
  async function openStoryGroup(ownerId: string) {
    const group = stories.filter(item => item.user_id === ownerId);
    if (!group.length) return;
    setActiveStoryOwnerId(ownerId);
    setActiveStoryIndex(0);
    setStoryReplyDraft('');
    setViewersOpen(false);
    setStoryViewers([]);
    if (ownerId !== currentUserId) {
      try {
        await markStoryViewed(group[0].id);
        setStories(items => items.map(item => item.id === group[0].id ? { ...item, viewedByMe: true } : item));
      } catch (error) {
        setStoryMessage(error instanceof Error ? error.message : 'Could not record this story view.');
      }
    }
  }

  async function advanceStory() {
    if (activeStoryIndex + 1 < activeStoryGroup.length) {
      const nextIndex = activeStoryIndex + 1;
      setActiveStoryIndex(nextIndex);
      const next = activeStoryGroup[nextIndex];
      if (next.user_id !== currentUserId) {
        try {
          await markStoryViewed(next.id);
          setStories(items => items.map(item => item.id === next.id ? { ...item, viewedByMe: true } : item));
        } catch { /* Keep the viewer moving if view tracking is temporarily unavailable. */ }
      }
    } else {
      setActiveStoryOwnerId(null);
      setViewersOpen(false);
    }
  }

  async function sendStoryReply() {
    if (!activeStory || !storyReplyDraft.trim() || storyBusy) return;
    setStoryBusy(true);
    try {
      await replyToStory(activeStory.id, storyReplyDraft);
      setStoryReplyDraft('');
      setStoryMessage('Reply sent.');
    } catch (error) {
      setStoryMessage(error instanceof Error ? error.message : 'Could not send your reply.');
    } finally {
      setStoryBusy(false);
    }
  }

  async function sendStoryReaction(reaction: '❤️' | '😂' | '😮' | '😢' | '🔥' | '👏') {
    if (!activeStory || storyBusy) return;
    setStoryBusy(true);
    try {
      await reactToStory(activeStory.id, reaction);
      setStoryMessage('Reaction sent.');
    } catch (error) {
      setStoryMessage(error instanceof Error ? error.message : 'Could not react to this story.');
    } finally {
      setStoryBusy(false);
    }
  }

  async function loadStoryViewers() {
    if (!activeStory || activeStory.user_id !== (await requireSupabase().auth.getUser()).data.user?.id) return;
    try {
      setStoryViewers(await getMyStoryViewers(activeStory.id));
      setViewersOpen(true);
    } catch (error) {
      setStoryMessage(error instanceof Error ? error.message : 'Could not load story viewers.');
    }
  }

  async function removeActiveStory() {
    if (!activeStory || storyBusy) return;
    Alert.alert('Delete story?', 'This story will be removed before its 24-hour expiry.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        void (async () => {
          setStoryBusy(true);
          try {
            await deleteStory(activeStory.id);
            const remaining = activeStoryGroup.filter(item => item.id !== activeStory.id);
            setStories(items => items.filter(item => item.id !== activeStory.id));
            if (remaining.length) setActiveStoryIndex(Math.min(activeStoryIndex, remaining.length - 1));
            else setActiveStoryOwnerId(null);
          } catch (error) {
            setStoryMessage(error instanceof Error ? error.message : 'Could not delete this story.');
          } finally {
            setStoryBusy(false);
          }
        })();
      } },
    ]);
  }

  useEffect(() => {
    void refreshStories();
    void requireSupabase().auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!activeStory || activeStory.media_type === 'video') return;
    const timer = setTimeout(() => { void advanceStory(); }, 6000);
    return () => clearTimeout(timer);
  }, [activeStory?.id, activeStoryIndex, activeStoryOwnerId]);


  return (
    <View style={{ gap: 8 }}>
      <View style={{ paddingBottom: 8, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 5 }}>
          <Text style={styles.mutedSmall}>STORIES · 24 HOURS</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 15, paddingRight: 10 }}>
          <TouchableOpacity onPress={chooseStory} disabled={storyBusy} style={{ width: 66, alignItems: 'center', gap: 6 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: COLORS.blue, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceRaised }}>
              <Text style={{ color: '#FFFFFF', fontSize: 29, lineHeight: 32 }}>+</Text>
            </View>
            <Text numberOfLines={1} style={{ color: COLORS.muted, fontSize: 10, fontWeight: '700' }}>{storyBusy ? 'Working…' : 'Your story'}</Text>
          </TouchableOpacity>
          {storyGroups.map(group => {
            const groupItems = stories.filter(item => item.user_id === group.user_id);
            const viewed = groupItems.every(item => item.viewedByMe);
            const author = group.author;
            return (
              <TouchableOpacity key={group.user_id} onPress={() => void openStoryGroup(group.user_id)} style={{ width: 66, alignItems: 'center', gap: 6 }}>
                <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: viewed ? COLORS.border : COLORS.blue, padding: 3 }}>
                  <View style={{ flex: 1, borderRadius: 25, overflow: 'hidden', backgroundColor: COLORS.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                    {author?.avatar_url
                      ? <Image source={{ uri: author.avatar_url }} style={{ width: '100%', height: '100%' }} />
                      : <Text style={styles.resultAvatarText}>{(author?.display_name || author?.username || 'C').slice(0, 1).toUpperCase()}</Text>}
                  </View>
                </View>
                <Text numberOfLines={1} style={{ color: COLORS.text, fontSize: 10, fontWeight: '700' }}>{author?.username || 'CREOVA'}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {!!storyMessage && <Text style={[styles.notice, { marginTop: 8 }]}>{storyMessage}</Text>}
      </View>
      <Modal visible={!!activeStory} animationType="fade" onRequestClose={() => setActiveStoryOwnerId(null)}>
        <View style={{ flex: 1, backgroundColor: '#05070D', paddingTop: Platform.OS === 'android' ? 28 : 48, paddingHorizontal: 12, paddingBottom: 22 }}>
          {activeStory && <>
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 14 }}>
              {activeStoryGroup.map((item, index) => <View key={item.id} style={{ flex: 1, height: 3, borderRadius: 3, backgroundColor: index <= activeStoryIndex ? '#FFFFFF' : '#526078' }} />)}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <View style={styles.resultAvatar}>
                {activeStory.author?.avatar_url
                  ? <Image source={{ uri: activeStory.author.avatar_url }} style={styles.requestAvatarImage} />
                  : <Text style={styles.resultAvatarText}>{(activeStory.author?.display_name || 'C').slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{activeStory.author?.display_name || activeStory.author?.username || 'CREOVA member'}</Text>
                <Text style={{ color: '#A9B4C8', fontSize: 10 }}>{new Date(activeStory.created_at).toLocaleString()}</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveStoryOwnerId(null)}><Text style={{ color: '#FFFFFF', fontSize: 23 }}>×</Text></TouchableOpacity>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {activeStory.media_type === 'video'
                ? <StoryVideo key={activeStory.id} uri={activeStory.mediaUrl} onFinish={() => { void advanceStory(); }} />
                : <Image source={{ uri: activeStory.mediaUrl }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />}
              {!!activeStory.caption && <Text style={{ color: '#FFFFFF', fontSize: 14, textAlign: 'center', padding: 12 }}>{activeStory.caption}</Text>}
            </View>
            {activeStory.user_id === currentUserId && <TouchableOpacity onPress={() => void loadStoryViewers()} style={{ alignSelf: 'flex-start', paddingVertical: 9 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 11 }}>◉ {activeStory.viewerCount} views · Viewers</Text>
            </TouchableOpacity>}
            {viewersOpen && <View style={{ maxHeight: 150, backgroundColor: '#111827', borderRadius: 12, padding: 10, marginBottom: 8 }}>
              <ScrollView>
                {storyViewers.map(viewer => <Text key={viewer.viewer_id} style={{ color: '#FFFFFF', fontSize: 12, paddingVertical: 4 }}>{viewer.viewer?.display_name || viewer.viewer?.username || 'CREOVA member'} · {new Date(viewer.viewed_at).toLocaleTimeString()}</Text>)}
                {!storyViewers.length && <Text style={{ color: '#A9B4C8', fontSize: 11 }}>No views yet.</Text>}
              </ScrollView>
            </View>}
            {activeStory.user_id === currentUserId
              ? <TouchableOpacity onPress={() => void removeActiveStory()} style={{ alignSelf: 'flex-end', padding: 8 }}><Text style={{ color: '#FF9BAF', fontSize: 12, fontWeight: '800' }}>Delete story</Text></TouchableOpacity>
              : <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                    {(['❤️', '😂', '😮', '😢', '🔥', '👏'] as const).map(reaction => <TouchableOpacity key={reaction} disabled={storyBusy} onPress={() => void sendStoryReaction(reaction)}><Text style={{ fontSize: 23 }}>{reaction}</Text></TouchableOpacity>)}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput value={storyReplyDraft} onChangeText={setStoryReplyDraft} maxLength={1000} placeholder="Reply to this story…" placeholderTextColor="#8794AA" style={{ flex: 1, borderWidth: 1, borderColor: '#344158', borderRadius: 22, paddingHorizontal: 15, paddingVertical: 11, color: '#FFFFFF' }} />
                    <TouchableOpacity disabled={storyBusy || !storyReplyDraft.trim()} onPress={() => void sendStoryReply()} style={{ padding: 10 }}><Text style={{ color: '#8DBBFF', fontWeight: '800' }}>{storyBusy ? '…' : 'Send'}</Text></TouchableOpacity>
                  </View>
                </View>}
            <TouchableOpacity onPress={() => void advanceStory()} style={{ alignSelf: 'center', padding: 10 }}><Text style={{ color: '#A9B4C8', fontSize: 10 }}>Tap to continue</Text></TouchableOpacity>
          </>}
        </View>
      </Modal>
      <Modal visible={!!selectedStoryAsset} transparent animationType="slide" onRequestClose={() => { if (!storyBusy) { setSelectedStoryAsset(null); setStoryCaptionDraft(''); } }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#101827', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 30, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800' }}>Your story</Text>
              <TouchableOpacity disabled={storyBusy} onPress={() => { setSelectedStoryAsset(null); setStoryCaptionDraft(''); }}><Text style={{ color: '#A9B4C8', fontSize: 22 }}>×</Text></TouchableOpacity>
            </View>
            {selectedStoryAsset?.type === 'video'
              ? <View style={{ height: 150, borderRadius: 12, backgroundColor: '#05070D', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 30 }}>▶</Text><Text style={{ color: '#A9B4C8', fontSize: 11, marginTop: 5 }}>Video selected · up to 60 seconds</Text></View>
              : selectedStoryAsset ? <Image source={{ uri: selectedStoryAsset.uri }} resizeMode="contain" style={{ width: '100%', height: 190, borderRadius: 12, backgroundColor: '#05070D' }} /> : null}
            <TextInput value={storyCaptionDraft} onChangeText={setStoryCaptionDraft} maxLength={500} placeholder="Add a caption…" placeholderTextColor="#8794AA" multiline style={{ minHeight: 46, maxHeight: 110, borderRadius: 12, borderWidth: 1, borderColor: '#344158', padding: 12, color: '#FFFFFF', fontSize: 13 }} />
            <Text style={{ color: '#A9B4C8', fontSize: 10, textAlign: 'right' }}>{storyCaptionDraft.length}/500 · Visible to your followers</Text>
            <TouchableOpacity disabled={storyBusy || !selectedStoryAsset} onPress={() => void publishSelectedStory()} style={{ backgroundColor: COLORS.blue, borderRadius: 12, padding: 14, alignItems: 'center', opacity: storyBusy ? 0.55 : 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{storyBusy ? 'Publishing…' : 'Share story'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ProfileScreen() {
  const [profile, setProfile] = useState<CreovaProfile | null>(null);
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<CreovaFeedPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<CreovaFeedPost[]>([]);
  const [showSavedPosts, setShowSavedPosts] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const [filter, setFilter] = useState<'GRID' | 'ITERATIONS'>('GRID');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList] = useState<FollowListEntry[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListError, setFollowListError] = useState('');

  async function loadProfile() {
    setError('');
    try {
      const [value, stats, feed] = await Promise.all([getMyProfile(), getMyProfileCounts(), getMyPosts()]);
      setProfile(value);
      setDisplayName(value.display_name);
      setBio(value.bio);
      setIsPrivate(value.is_private);
      setCounts(stats);
      setPosts(feed.filter(post => post.author_id === value.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your profile.');
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function openFollowList(kind: 'followers' | 'following') {
    setFollowListType(kind);
    setFollowList([]);
    setFollowListError('');
    setFollowListLoading(true);
    try { setFollowList(await getMyFollowList(kind)); }
    catch (e) { setFollowListError(e instanceof Error ? e.message : 'Could not load this list.'); }
    finally { setFollowListLoading(false); }
  }

  async function loadSavedPosts() {
    setSavedLoading(true);
    setNotice('');
    try {
      setSavedPosts(await getSavedPosts());
      setShowSavedPosts(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load saved posts.');
    } finally {
      setSavedLoading(false);
    }
  }

  async function chooseAvatar() {
    setNotice('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice('Allow photo library access to choose a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        setNotice('Choose a JPEG, PNG, or WebP image.');
        return;
      }
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        setNotice('Choose an image smaller than 5 MB.');
        return;
      }
      setAvatarBusy(true);
      const updated = await uploadMyAvatar({ uri: asset.uri, mimeType });
      setProfile(updated);
      setNotice('Profile photo updated.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not upload your profile photo.');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function deleteAvatar() {
    setAvatarBusy(true);
    setNotice('');
    try {
      const updated = await removeMyAvatar();
      setProfile(updated);
      setNotice('Profile photo removed.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not remove your profile photo.');
    } finally {
      setAvatarBusy(false);
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
      const updated = await updateMyProfile({ display_name: displayName, bio, is_private: isPrivate });
      setProfile(updated);
      setEditing(false);
      setNotice('Your profile has been updated.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmSignOut() {
    try {
      const { error: signOutError } = await supabase!.auth.signOut();
      if (signOutError) throw signOutError;
      setMenuOpen(false);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not sign out.');
    }
  }

  function requestSignOut() {
    Alert.alert('Sign out of CREOVA?', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void confirmSignOut(); } },
    ]);
  }

  const visiblePosts = showSavedPosts ? savedPosts : posts.filter(post => filter === 'GRID' || post.post_type === 'iteration');
  const analyticsTotals = posts.reduce((totals, post) => ({
    likes: totals.likes + post.likeCount,
    comments: totals.comments + post.commentCount,
  }), { likes: 0, comments: 0 });
  const topPost = [...posts].sort((a, b) => b.likeCount - a.likeCount)[0];

  async function shareProfile() {
    if (!profile) return;
    try {
      await Share.share({ message: `Check out @${profile.username} on CREOVA.` });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not share your profile.');
    }
  }

  async function updatePostPin(post: CreovaFeedPost) {
    setNotice('');
    try {
      await setPostPinned(post.id, !post.is_pinned);
      setPosts(await getMyPosts());
      setNotice(post.is_pinned ? 'Post unpinned from your profile.' : 'Post pinned to your profile.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update the pinned post.');
    }
  }

  function requestPostPin(post: CreovaFeedPost) {
    Alert.alert(
      post.is_pinned ? 'Unpin this post?' : 'Pin this post?',
      post.is_pinned ? 'It will return to its normal position in your grid.' : 'You can pin up to three posts at the top of your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: post.is_pinned ? 'Unpin' : 'Pin to profile', onPress: () => { void updatePostPin(post); } },
      ],
    );
  }

  return <View style={styles.screenContent}>
    <View style={styles.profileTopBar}>
      <Text style={styles.profileTopHandle}>@{profile?.username || 'Profile'}</Text>
      <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.profileMenuButton} accessibilityRole="button" accessibilityLabel="Open profile menu">
        <Text style={styles.profileMenuButtonText}>≡</Text>
      </TouchableOpacity>
    </View>
    {profile ? <>
      <View style={styles.profileHero}>
        <View style={styles.profileHeroTop}>
          <View style={styles.avatarColumn}>
            {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} resizeMode="cover" /> : <View style={styles.avatar}><Text style={styles.avatarText}>{(profile.display_name || profile.username).slice(0,1).toUpperCase()}</Text></View>}
            {editing && <>
              <TouchableOpacity disabled={avatarBusy} onPress={chooseAvatar} style={styles.avatarAction}>
                <Text style={styles.avatarActionText}>{avatarBusy ? 'Uploading…' : profile.avatar_url ? 'Change photo' : 'Add photo'}</Text>
              </TouchableOpacity>
              {profile.avatar_url && <TouchableOpacity disabled={avatarBusy} onPress={deleteAvatar} style={styles.avatarRemoveAction}>
                <Text style={styles.avatarRemoveText}>Remove</Text>
              </TouchableOpacity>}
            </>}
          </View>
          <View style={styles.profileIdentity}>
            <Text style={styles.profileName}>{profile.display_name}</Text>
            <Text style={styles.profileHandle}>@{profile.username}</Text>
            <Text style={styles.profilePrivacy}>{profile.is_private ? 'Private account' : 'Creator account'}</Text>
          </View>
        </View>
        <Text style={styles.profileCopy}>{profile.bio || 'Add a bio to tell your story.'}</Text>
        <View style={styles.profileStats}>
          <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{counts.posts}</Text><Text style={styles.profileStatLabel}>Posts</Text></View>
          <TouchableOpacity onPress={() => void openFollowList('followers')} style={styles.profileStat} accessibilityRole="button" accessibilityLabel={`${counts.followers} followers. Open followers list.`}>
            <Text style={styles.profileStatNumber}>{counts.followers}</Text><Text style={styles.profileStatLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void openFollowList('following')} style={styles.profileStat} accessibilityRole="button" accessibilityLabel={`${counts.following} following. Open following list.`}>
            <Text style={styles.profileStatNumber}>{counts.following}</Text><Text style={styles.profileStatLabel}>Following</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.profilePrimaryActions}>
          <TouchableOpacity onPress={() => { setNotice(''); setEditing(value => !value); }} style={styles.profilePrimaryButton}>
            <Text style={styles.profilePrimaryButtonText}>{editing ? 'Done editing' : 'Edit profile'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void shareProfile()} style={styles.profileSecondaryButton}>
            <Text style={styles.profileSecondaryButtonText}>Share profile</Text>
          </TouchableOpacity>
        </View>
      </View>
      <StoriesSection />
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      {editing && <View style={styles.profileEditorCard}>
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
      </View>}
      <View style={styles.profileFilterRow}>
        <TouchableOpacity onPress={() => { setShowSavedPosts(false); setFilter('GRID'); }} style={[styles.profileFilter, !showSavedPosts && filter === 'GRID' && styles.profileFilterActive]}>
          <Text style={[styles.profileFilterText, !showSavedPosts && filter === 'GRID' && styles.profileFilterTextActive]}>▦  Grid</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setShowSavedPosts(false); setFilter('ITERATIONS'); }} style={[styles.profileFilter, !showSavedPosts && filter === 'ITERATIONS' && styles.profileFilterActive]}>
          <Text style={[styles.profileFilterText, !showSavedPosts && filter === 'ITERATIONS' && styles.profileFilterTextActive]}>⟳  Iterations</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { if (!showSavedPosts) void loadSavedPosts(); }} disabled={savedLoading} style={[styles.profileFilter, showSavedPosts && styles.profileFilterActive]}>
          <Text style={[styles.profileFilterText, showSavedPosts && styles.profileFilterTextActive]}>{savedLoading ? 'Loading…' : '▣  Saved'}</Text>
        </TouchableOpacity>
      </View>
      {savedLoading && showSavedPosts && <EmptyState title="Loading saved posts" description="Fetching the posts you bookmarked privately." />}
      {visiblePosts.length ? <View style={styles.profilePostGrid}>
        {visiblePosts.map(post => <TouchableOpacity key={post.id} style={styles.profilePostTile} activeOpacity={0.9} onLongPress={() => requestPostPin(post)} accessibilityRole="button" accessibilityLabel={post.is_pinned ? 'Pinned post. Long press to unpin.' : 'Long press to pin this post'}>
          {post.media[0] ? <Image source={{ uri: post.media[0].signedUrl }} style={styles.profilePostImage} resizeMode="cover" /> : <View style={styles.profilePostTextTile}><Text style={styles.profilePostType}>{post.post_type.toUpperCase()}</Text><Text numberOfLines={4} style={styles.profilePostCaption}>{post.caption || 'CREOVA creation'}</Text></View>}
          <View style={styles.profilePostMetric}><Text style={styles.profilePostMetricText}>♥ {post.likeCount}</Text></View>
          {post.is_pinned && <View style={styles.profilePostPinned}><Text style={styles.profilePostPinnedText}>📌</Text></View>}
        </TouchableOpacity>)}
      </View> : !savedLoading && <EmptyState title={showSavedPosts ? 'No saved posts yet' : filter === 'GRID' ? 'Your work starts here' : `No ${filter.toLowerCase()} yet`} description={showSavedPosts ? 'Save a post from your feed and it will appear here. Only you can see this collection.' : 'Publish a post, Anchor or Iteration to build your visible creator journey.'} />}
    </> : <EmptyState title={error || 'Loading your profile…'} description={error ? 'Check your connection and refresh your profile.' : 'Your profile and creator activity are being loaded from CREOVA.'} />}
    <Modal visible={!!followListType} transparent animationType="slide" onRequestClose={() => setFollowListType(null)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' }}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFollowListType(null)} />
        <View style={{ maxHeight: '78%', minHeight: '48%', backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: COLORS.border, padding: 18, gap: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 3 }}>
              <Text style={styles.profileMenuTitle}>{followListType === 'followers' ? 'Followers' : 'Following'}</Text>
              <Text style={styles.mutedSmall}>{followList.length} ACCOUNTS</Text>
            </View>
            <TouchableOpacity onPress={() => setFollowListType(null)} accessibilityRole="button" accessibilityLabel="Close follow list"><Text style={styles.profileMenuClose}>×</Text></TouchableOpacity>
          </View>
          {followListLoading && <EmptyState title="Loading accounts" description="Fetching this list from CREOVA." />}
          {!!followListError && <Text style={styles.notice}>{followListError}</Text>}
          {!followListLoading && !followListError && followList.length === 0 && <EmptyState
            title={followListType === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            description={followListType === 'followers' ? 'When people follow you, they will appear here.' : 'Accounts you follow will appear here.'}
          />}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 9, paddingBottom: 10 }}>
            {followList.map(person => <View key={person.id} style={styles.resultRow}>
              <View style={styles.resultAvatar}>
                {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.requestAvatarImage} /> : <Text style={styles.resultAvatarText}>{(person.display_name || person.username || 'C').slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{person.display_name || person.username}</Text>
                <Text style={styles.resultHandle}>@{person.username}</Text>
              </View>
            </View>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <View style={styles.profileMenuOverlay}>
        <TouchableOpacity style={styles.profileMenuScrim} activeOpacity={1} onPress={() => setMenuOpen(false)} />
        <View style={styles.profileMenuDrawer}>
          <View style={styles.profileMenuHeader}>
            <Text style={styles.profileMenuTitle}>Account</Text>
            <TouchableOpacity onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="Close profile menu">
              <Text style={styles.profileMenuClose}>×</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.profileMenuItem} onPress={() => { setMenuOpen(false); setNotice(''); setEditing(true); }}>
            <Text style={styles.profileMenuItemText}>Account & privacy</Text><Text style={styles.profileMenuChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileMenuItem} onPress={() => { setMenuOpen(false); void loadSavedPosts(); }}>
            <Text style={styles.profileMenuItemText}>Saved posts</Text><Text style={styles.profileMenuChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileMenuItem} onPress={() => { setMenuOpen(false); setAnalyticsOpen(true); }}>
            <Text style={styles.profileMenuItemText}>Creator analytics</Text><Text style={styles.profileMenuChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.profileMenuDivider} />
          <TouchableOpacity style={styles.profileMenuSignOut} onPress={requestSignOut}>
            <Text style={styles.profileMenuSignOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <Modal visible={analyticsOpen} transparent animationType="slide" onRequestClose={() => setAnalyticsOpen(false)}>
      <View style={styles.analyticsOverlay}>
        <TouchableOpacity style={styles.analyticsScrim} activeOpacity={1} onPress={() => setAnalyticsOpen(false)} />
        <View style={styles.analyticsSheet}>
          <View style={styles.profileMenuHeader}>
            <Text style={styles.profileMenuTitle}>Creator analytics</Text>
            <TouchableOpacity onPress={() => setAnalyticsOpen(false)} accessibilityRole="button" accessibilityLabel="Close analytics">
              <Text style={styles.profileMenuClose}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.analyticsCaption}>Engagement from your latest {posts.length} loaded posts</Text>
          <View style={styles.analyticsStats}>
            <View style={styles.analyticsStat}><Text style={styles.analyticsValue}>{counts.posts}</Text><Text style={styles.analyticsLabel}>Total posts</Text></View>
            <View style={styles.analyticsStat}><Text style={styles.analyticsValue}>{analyticsTotals.likes}</Text><Text style={styles.analyticsLabel}>Likes</Text></View>
            <View style={styles.analyticsStat}><Text style={styles.analyticsValue}>{analyticsTotals.comments}</Text><Text style={styles.analyticsLabel}>Comments</Text></View>
          </View>
          <View style={styles.analyticsTopPost}>
            <Text style={styles.analyticsLabel}>TOP POST BY LIKES</Text>
            {topPost ? <Text style={styles.analyticsTopPostText} numberOfLines={3}>{topPost.caption || 'Media post'} · {topPost.likeCount} likes</Text> : <Text style={styles.analyticsTopPostText}>Publish a post to see performance here.</Text>}
          </View>
          <Text style={styles.analyticsFootnote}>Views and reach are not tracked yet, so they are not estimated or displayed.</Text>
        </View>
      </View>
    </Modal>
  </View>;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 760;

  useEffect(() => {
    const handleUrl = (url: string) => {
      const match = url.match(/^creova:\/\/post\/([0-9a-f-]{36})$/i);
      if (!match) return;
      setSharedPostId(match[1]);
      setActiveTab('Home');
    };
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); }).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => handleUrl(event.url));
    return () => subscription.remove();
  }, []);

  const renderScreen = () => {
    switch (activeTab) {
      case 'Discover': return <DiscoverScreen onOpenPost={(postId) => { setSharedPostId(postId); setActiveTab('Home'); }} />;
      case 'Create': return <CreateScreen />;
      case 'Inbox': return <InboxScreen onOpenPost={(postId) => { setSharedPostId(postId); setActiveTab('Home'); }} />;
      case 'Profile': return <ProfileScreen />;
      default: return <HomeScreen sharedPostId={sharedPostId} onSharedPostHandled={() => setSharedPostId(null)} />;
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.app}>
        <View style={[styles.body, isWide && styles.bodyWide]}>
          {isWide && <View style={styles.sideNav}>
            {TABS.map(tab => <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.sideNavItem, activeTab === tab.key && styles.sideNavItemActive]}>
              <Text style={[styles.sideNavSymbol, activeTab === tab.key && styles.activeText]}>{tab.symbol}</Text>
              <Text style={[styles.sideNavLabel, activeTab === tab.key && styles.activeText]}>{tab.label}</Text>
            </TouchableOpacity>)}
          </View>}
          <ScrollView style={styles.mainScroll} scrollEnabled={activeTab !== 'Inbox'} contentContainerStyle={activeTab === 'Profile' ? styles.mainScrollContentProfile : activeTab === 'Inbox' ? [styles.mainScrollContent, { flexGrow: 1 }] : styles.mainScrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.contentMax, isWide && styles.contentMaxWide, activeTab === 'Inbox' && { flex: 1 }]}>{renderScreen()}</View>
          </ScrollView>
        </View>
        {!isWide && <View style={[styles.bottomNav, { height: 66 + insets.bottom, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 8) }]}>
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
  topBar: { height: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarWide: { paddingHorizontal: 36 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 32, height: 32, borderRadius: 13, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: '#355B9C', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#8DB8FF', fontSize: 21, fontWeight: '800' },
  brandName: { color: COLORS.text, fontSize: 15, fontWeight: '900', letterSpacing: 2.6 },
  brandTagline: { color: COLORS.muted, fontSize: 8, letterSpacing: 1.4, marginTop: 3 },
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
  mainScrollContent: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28 },
  mainScrollContentProfile: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 28 },
  contentMax: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  contentMaxWide: { maxWidth: 760 },
  screenContent: { gap: 12 },
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
  emptyCard: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, padding: 23, alignItems: 'center', gap: 10 },
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
  postCard: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, padding: 0, paddingBottom: 20, gap: 10 },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  postAuthor: { flex: 1, gap: 2 },
  postCaption: { color: COLORS.text, fontSize: 14, lineHeight: 21, fontWeight: '400' },
  feedImage: { width: '100%', aspectRatio: 1, borderRadius: 0, backgroundColor: '#000000' },
  imagePickButton: { minHeight: 43, borderRadius: 11, borderWidth: 1, borderColor: '#355B9C', backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  imagePickButtonText: { color: '#A7C6FF', fontSize: 12, fontWeight: '800' },
  imagePreviewWrap: { gap: 8 },
  imagePreview: { width: '100%', aspectRatio: 1, borderRadius: 0, backgroundColor: '#000000' },
  removeImageButton: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 3 },
  removeImageText: { color: '#FF91A9', fontSize: 11, fontWeight: '700' },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingTop: 4 },
  postAction: { paddingVertical: 3 },
  postActionText: { color: COLORS.muted, fontSize: 19, fontWeight: '400', minWidth: 22 },
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
  profileHero: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 0, borderWidth: 0, backgroundColor: 'transparent', gap: 15 },
  profileHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileIdentity: { flex: 1, gap: 5 },
  profileStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, borderTopWidth: 0, borderBottomWidth: 0 },
  profileStat: { alignItems: 'center', gap: 4 },
  profileStatNumber: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  profileStatLabel: { color: COLORS.muted, fontSize: 10, letterSpacing: 0, fontWeight: '600' },
  profileTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14 },
  profileTopHandle: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  profilePrimaryActions: { flexDirection: 'row', gap: 9, paddingHorizontal: 14, paddingBottom: 8 },
  profilePrimaryButton: { flex: 1, minHeight: 40, borderRadius: 9, backgroundColor: COLORS.blue, alignItems: 'center', justifyContent: 'center' },
  profilePrimaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  profileSecondaryButton: { flex: 1, minHeight: 40, borderRadius: 9, backgroundColor: COLORS.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  profileSecondaryButtonText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  profileMenuButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  profileMenuButtonText: { color: '#A7C6FF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  profileMenuOverlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.58)' },
  profileMenuScrim: { ...StyleSheet.absoluteFill },
  profileMenuDrawer: { width: '82%', maxWidth: 340, height: '100%', backgroundColor: COLORS.surface, borderLeftWidth: 1, borderLeftColor: COLORS.border, paddingHorizontal: 20, paddingTop: 54, gap: 4 },
  profileMenuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8 },
  profileMenuTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  profileMenuClose: { color: COLORS.muted, fontSize: 30, lineHeight: 32, paddingHorizontal: 5 },
  profileMenuItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 3 },
  profileMenuItemText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  profileMenuChevron: { color: COLORS.muted, fontSize: 23 },
  profileMenuDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  profileMenuSignOut: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 3 },
  profileMenuSignOutText: { color: '#FF91A9', fontSize: 13, fontWeight: '800' },
  profileEditorCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 16, gap: 10 },
  profileFeatureRow: { flexDirection: 'row', gap: 9 },
  profileFeature: { flex: 1, padding: 13, borderRadius: 14, backgroundColor: COLORS.surfaceRaised, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  profileFeatureTitle: { color: '#A7C6FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  profileFeatureCopy: { color: COLORS.muted, fontSize: 10, lineHeight: 15 },
  profileContentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileFilterRow: { flexDirection: 'row', gap: 0, marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  profileFilter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 0, borderWidth: 0, borderBottomWidth: 2, borderBottomColor: 'transparent', backgroundColor: 'transparent' },
  profileFilterActive: { borderBottomColor: COLORS.blue, backgroundColor: 'transparent' },
  profileFilterText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  profileFilterTextActive: { color: '#A7C6FF' },
  profilePostGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 0 },
  profilePostTile: { width: '33.333%', aspectRatio: 1, borderRadius: 0, overflow: 'hidden', backgroundColor: '#000000', borderWidth: 0 },
  profilePostImage: { width: '100%', height: '100%' },
  profilePostMetric: { position: 'absolute', left: 5, bottom: 5, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.62)' },
  profilePostMetricText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  profilePostPinned: { position: 'absolute', top: 5, right: 5, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.7)' },
  profilePostPinnedText: { color: '#FFFFFF', fontSize: 10 },
  analyticsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  analyticsScrim: { ...StyleSheet.absoluteFill },
  analyticsSheet: { backgroundColor: COLORS.surfaceRaised, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 30, gap: 16 },
  analyticsCaption: { color: COLORS.muted, fontSize: 12 },
  analyticsStats: { flexDirection: 'row', gap: 8 },
  analyticsStat: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, gap: 5 },
  analyticsValue: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  analyticsLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  analyticsTopPost: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, gap: 7 },
  analyticsTopPostText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  analyticsFootnote: { color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  profilePostTextTile: { flex: 1, padding: 9, justifyContent: 'space-between', gap: 6 },
  profilePostType: { color: '#A7C6FF', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  profilePostCaption: { color: COLORS.text, fontSize: 10, lineHeight: 14 },
  profileCard: { alignItems: 'center', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 9 },
  avatarColumn: { width: 88, alignItems: 'center', gap: 6 },
  avatarAction: { minWidth: 78, alignItems: 'center', paddingVertical: 5, paddingHorizontal: 7, borderRadius: 8, backgroundColor: COLORS.accentSoft },
  avatarActionText: { color: '#A7C6FF', fontSize: 9, fontWeight: '800' },
  avatarRemoveAction: { paddingVertical: 2 },
  avatarRemoveText: { color: COLORS.muted, fontSize: 9, fontWeight: '700' },
  avatar: { width: 76, height: 76, borderRadius: 28, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: '#4268A4', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 76, height: 76, borderRadius: 28, borderWidth: 1, borderColor: '#4268A4', backgroundColor: COLORS.accentSoft },
  avatarText: { color: '#A7C6FF', fontSize: 36, fontWeight: '900' },
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
  resultAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  resultAvatarText: { color: '#A7C6FF', fontSize: 17, fontWeight: '900' },
  resultInfo: { flex: 1, gap: 4 },
  resultName: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  resultHandle: { color: COLORS.muted, fontSize: 11, fontWeight: '400' },
  requestCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 15, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  requestAvatarImage: { width: 42, height: 42, borderRadius: 15 },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  acceptRequestButton: { backgroundColor: COLORS.blue, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9 },
  acceptRequestText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  declineRequestButton: { backgroundColor: COLORS.surfaceRaised, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border },
  declineRequestText: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },

  followButton: { backgroundColor: COLORS.accentSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  followButtonText: { color: '#A7C6FF', fontSize: 10, fontWeight: '800' },
  profileHandle: { color: '#A7C6FF', fontSize: 12, fontWeight: '700' },
  profilePrivacy: { color: COLORS.muted, fontSize: 11, letterSpacing: 0, fontWeight: '400' },
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
  return <SafeAreaProvider><AuthGate><MainApp /></AuthGate></SafeAreaProvider>;
}
