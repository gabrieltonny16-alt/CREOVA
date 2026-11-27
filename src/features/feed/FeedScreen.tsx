import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

type Author = {
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type CountRow = { count: number };

type FeedPost = {
  id: string;
  author_id: string;
  caption: string;
  created_at: string;
  visibility: "public" | "followers";
  author: Author | null;
  likes: CountRow[];
  comments: CountRow[];
};

type FeedComment = {
  id: string;
  body: string;
  created_at: string;
  author: Pick<Author, "username" | "display_name"> | null;
};

type Props = {
  userId: string | null;
  mode: "feed" | "create";
  onSignIn: () => void;
  onJoin: () => void;
  onOpenComposer: () => void;
  onPostCreated: () => void;
};

const PAGE_SIZE = 30;

function timeAgo(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(value).toLocaleDateString();
}

export default function FeedScreen({ userId, mode, onSignIn, onJoin, onOpenComposer, onPostCreated }: Props) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, FeedComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [feedMode, setFeedMode] = useState<"For you" | "Following">("For you");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loadFeed = useCallback(async (showRefresh = false) => {
    if (!userId) {
      setPosts([]);
      setLikedPostIds(new Set());
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setNotice("");

    try {
      let query = supabase
        .from("posts")
        .select("id,author_id,caption,created_at,visibility,author:profiles!posts_author_id_fkey(username,display_name,avatar_url),likes:post_likes(count),comments:post_comments(count)")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (feedMode === "Following") {
        const { data: follows, error: followError } = await supabase
          .from("user_follows")
          .select("following_id")
          .eq("follower_id", userId)
          .eq("status", "accepted");
        if (followError) throw followError;
        const authorIds = [...new Set([userId, ...(follows ?? []).map((row) => row.following_id)])];
        query = query.in("author_id", authorIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const nextPosts = (data ?? []) as unknown as FeedPost[];
      setPosts(nextPosts);

      if (nextPosts.length) {
        const { data: likes, error: likesError } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", userId)
          .in("post_id", nextPosts.map((post) => post.id));
        if (likesError) throw likesError;
        setLikedPostIds(new Set((likes ?? []).map((row) => row.post_id)));
      } else {
        setLikedPostIds(new Set());
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "We couldn't load your feed. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, feedMode]);

  useEffect(() => {
    if (mode === "feed") void loadFeed();
  }, [loadFeed, mode]);

  const publishPost = async () => {
    const cleanCaption = caption.trim();
    if (!userId) {
      setNotice("Sign in to publish a post.");
      return;
    }
    if (!cleanCaption) {
      setNotice("Write something before publishing.");
      return;
    }
    if (cleanCaption.length > 2200) {
      setNotice("Posts can contain up to 2,200 characters.");
      return;
    }

    setPublishing(true);
    setNotice("");
    const { error } = await supabase.from("posts").insert({
      author_id: userId,
      caption: cleanCaption,
      post_type: "post",
      visibility,
    });

    if (error) {
      setNotice(error.message);
      setPublishing(false);
      return;
    }

    setCaption("");
    setVisibility("public");
    setPublishing(false);
    onPostCreated();
  };

  const toggleLike = async (post: FeedPost) => {
    if (!userId || busyPostId) return;
    setBusyPostId(post.id);
    const wasLiked = likedPostIds.has(post.id);
    setLikedPostIds((current) => {
      const next = new Set(current);
      if (wasLiked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    setPosts((current) => current.map((item) => item.id === post.id
      ? { ...item, likes: [{ count: Math.max(0, (item.likes?.[0]?.count ?? 0) + (wasLiked ? -1 : 1)) }] }
      : item));

    const result = wasLiked
      ? await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", userId)
      : await supabase.from("post_likes").insert({ post_id: post.id, user_id: userId });

    if (result.error) {
      setNotice("Your like couldn't be saved. Please try again.");
      await loadFeed(true);
    }
    setBusyPostId(null);
  };

  const loadComments = async (postId: string) => {
    const { data, error } = await supabase
      .from("post_comments")
      .select("id,body,created_at,author:profiles!post_comments_user_id_fkey(username,display_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) {
      setNotice("Comments couldn't be loaded. Please try again.");
      return;
    }
    setCommentsByPost((current) => ({ ...current, [postId]: (data ?? []) as unknown as FeedComment[] }));
  };

  const toggleComments = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(postId);
    if (!commentsByPost[postId]) await loadComments(postId);
  };

  const publishComment = async (postId: string) => {
    if (!userId) return;
    const body = (commentDrafts[postId] ?? "").trim();
    if (!body) return;
    setBusyPostId(postId);
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: userId,
      body,
    });
    if (error) {
      setNotice("Your comment couldn't be published. Please try again.");
    } else {
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await loadComments(postId);
      setPosts((current) => current.map((post) => post.id === postId
        ? { ...post, comments: [{ count: (post.comments?.[0]?.count ?? 0) + 1 }] }
        : post));
    }
    setBusyPostId(null);
  };

  if (!userId) {
    return (
      <View style={styles.guestWrap}>
        <Text style={styles.eyebrow}>CREOVA COMMUNITY</Text>
        <Text style={styles.title}>{mode === "create" ? "Share your first post" : "Your feed starts here"}</Text>
        <Text style={styles.body}>Join CREOVA to publish updates, follow creators and take part in conversations.</Text>
        <Pressable accessibilityRole="button" onPress={onJoin} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>CREATE ACCOUNT</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSignIn} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>I ALREADY HAVE AN ACCOUNT</Text>
        </Pressable>
      </View>
    );
  }

  if (mode === "create") {
    return (
      <View style={styles.createScreen}>
        <Text style={styles.eyebrow}>CREATE</Text>
        <Text style={styles.title}>What's happening?</Text>
        <TextInput
          accessibilityLabel="Post caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="Share an update with your community…"
          placeholderTextColor="#71809A"
          multiline
          maxLength={2200}
          textAlignVertical="top"
          style={styles.captionInput}
        />
        <Text style={styles.characterCount}>{caption.length.toLocaleString()} / 2,200</Text>
        <Text style={styles.fieldLabel}>WHO CAN SEE THIS POST?</Text>
        <View style={styles.visibilityRow}>
          {(["public", "followers"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: visibility === value }}
              onPress={() => setVisibility(value)}
              style={[styles.visibilityOption, visibility === value && styles.visibilitySelected]}
            >
              <Text style={[styles.visibilityText, visibility === value && styles.visibilityTextSelected]}>
                {value === "public" ? "Everyone" : "Followers"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>Text posts are available in this first publishing build. Photo and video publishing are the next media milestone.</Text>
        {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: publishing || !caption.trim() }}
          disabled={publishing || !caption.trim()}
          onPress={() => void publishPost()}
          style={[styles.primaryButton, (publishing || !caption.trim()) && styles.disabledButton]}
        >
          {publishing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>PUBLISH POST</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.feedScreen}>
      <View style={styles.feedHeading}>
        <View>
          <Text style={styles.eyebrow}>YOUR COMMUNITY</Text>
          <Text style={styles.title}>Home</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void loadFeed(true)} style={styles.refreshButton}>
          <Text style={styles.refreshText}>REFRESH</Text>
        </Pressable>
      </View>

      <View style={styles.feedFilters}>
        {(["For you", "Following"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: feedMode === value }}
            onPress={() => setFeedMode(value)}
            style={[styles.filterOption, feedMode === value && styles.filterSelected]}
          >
            <Text style={[styles.filterText, feedMode === value && styles.filterTextSelected]}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={onOpenComposer} style={styles.quickComposer}>
        <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>C</Text></View>
        <Text style={styles.quickComposerText}>Share something with your community…</Text>
        <Text style={styles.quickComposerPlus}>+</Text>
      </Pressable>

      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#8CB8FF" /><Text style={styles.body}>Loading your feed…</Text></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={posts.length ? styles.postList : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadFeed(true)} tintColor="#8CB8FF" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Your feed is ready for its first posts.</Text>
              <Text style={styles.body}>{feedMode === "Following" ? "Posts from people you follow will appear here." : "Be one of the first to share something with the CREOVA community."}</Text>
              <Pressable accessibilityRole="button" onPress={onOpenComposer} style={styles.emptyCreateButton}>
                <Text style={styles.secondaryButtonText}>CREATE A POST</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const liked = likedPostIds.has(item.id);
            const commentCount = item.comments?.[0]?.count ?? 0;
            const likeCount = item.likes?.[0]?.count ?? 0;
            const commentsOpen = expandedPostId === item.id;
            return (
              <View style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{(item.author?.display_name ?? item.author?.username ?? "C").slice(0, 1).toUpperCase()}</Text></View>
                  <View style={styles.authorBlock}>
                    <Text style={styles.authorName}>{item.author?.display_name ?? "CREOVA member"}</Text>
                    <Text style={styles.authorMeta}>@{item.author?.username ?? "member"} · {timeAgo(item.created_at)}</Text>
                  </View>
                  {item.visibility === "followers" ? <Text style={styles.visibilityTag}>FOLLOWERS</Text> : null}
                </View>
                <Text style={styles.postCaption}>{item.caption}</Text>
                <View style={styles.postActions}>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: liked }} onPress={() => void toggleLike(item)} style={styles.actionButton}>
                    <Text style={[styles.actionText, liked && styles.likedText]}>{liked ? "♥ Liked" : "♡ Like"} · {likeCount}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void toggleComments(item.id)} style={styles.actionButton}>
                    <Text style={styles.actionText}>◯ Comment · {commentCount}</Text>
                  </Pressable>
                </View>
                {commentsOpen ? (
                  <View style={styles.commentsPanel}>
                    {(commentsByPost[item.id] ?? []).map((comment) => (
                      <View key={comment.id} style={styles.commentRow}>
                        <Text style={styles.commentAuthor}>@{comment.author?.username ?? "member"}</Text>
                        <Text style={styles.commentBody}>{comment.body}</Text>
                      </View>
                    ))}
                    {commentsByPost[item.id]?.length === 0 ? <Text style={styles.noComments}>Be the first to comment.</Text> : null}
                    <View style={styles.commentComposer}>
                      <TextInput
                        accessibilityLabel="Write a comment"
                        value={commentDrafts[item.id] ?? ""}
                        onChangeText={(value) => setCommentDrafts((current) => ({ ...current, [item.id]: value }))}
                        placeholder="Write a comment…"
                        placeholderTextColor="#71809A"
                        maxLength={2000}
                        style={styles.commentInput}
                      />
                      <Pressable
                        accessibilityRole="button"
                        disabled={!(commentDrafts[item.id] ?? "").trim() || busyPostId === item.id}
                        onPress={() => void publishComment(item.id)}
                        style={styles.commentSend}
                      >
                        <Text style={styles.commentSendText}>SEND</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  feedScreen: { flex: 1, backgroundColor: "#070A12" },
  feedHeading: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "#6E9FFF", fontSize: 10, fontWeight: "800", letterSpacing: 2.2 },
  title: { color: "#F4F7FF", fontSize: 26, fontWeight: "800", marginTop: 3 },
  refreshButton: { borderWidth: 1, borderColor: "#315B89", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  refreshText: { color: "#B6D6FF", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  feedFilters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 9 },
  filterOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: "#26344D" },
  filterSelected: { backgroundColor: "#17345D", borderColor: "#477CC9" },
  filterText: { color: "#9BAAC2", fontSize: 11, fontWeight: "700" },
  filterTextSelected: { color: "#FFFFFF" },
  quickComposer: { marginHorizontal: 14, marginBottom: 10, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: "#1D2A43", backgroundColor: "#0D1322", flexDirection: "row", alignItems: "center", gap: 10 },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1C355C", alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#D7E7FF", fontSize: 14, fontWeight: "900" },
  quickComposerText: { color: "#8C9AB2", fontSize: 12, flex: 1 },
  quickComposerPlus: { color: "#A9CCFF", fontSize: 23, fontWeight: "600" },
  notice: { color: "#F0B7A8", fontSize: 11, paddingHorizontal: 16, paddingVertical: 6 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  body: { color: "#A4B2CA", fontSize: 12, lineHeight: 19 },
  postList: { paddingHorizontal: 12, paddingBottom: 18, gap: 10 },
  emptyList: { flexGrow: 1, paddingHorizontal: 18, justifyContent: "center" },
  emptyState: { alignItems: "center", gap: 10, paddingVertical: 28 },
  emptyTitle: { color: "#F4F7FF", fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyCreateButton: { borderWidth: 1, borderColor: "#477CC9", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, marginTop: 5 },
  postCard: { backgroundColor: "#0D1322", borderWidth: 1, borderColor: "#1D2A43", borderRadius: 16, padding: 13, gap: 12 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  authorBlock: { flex: 1 },
  authorName: { color: "#F4F7FF", fontSize: 12, fontWeight: "800" },
  authorMeta: { color: "#7F90AA", fontSize: 10, marginTop: 2 },
  visibilityTag: { color: "#91B7EE", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  postCaption: { color: "#E5ECF8", fontSize: 13, lineHeight: 20 },
  postActions: { flexDirection: "row", gap: 18, borderTopWidth: 1, borderTopColor: "#1D2A43", paddingTop: 10 },
  actionButton: { paddingVertical: 2 },
  actionText: { color: "#9EADC5", fontSize: 11, fontWeight: "700" },
  likedText: { color: "#FF8DA6" },
  commentsPanel: { borderTopWidth: 1, borderTopColor: "#1D2A43", paddingTop: 10, gap: 9 },
  commentRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  commentAuthor: { color: "#B7D2F8", fontSize: 10, fontWeight: "800" },
  commentBody: { color: "#CFD8E8", fontSize: 11, flexShrink: 1 },
  noComments: { color: "#7F90AA", fontSize: 10 },
  commentComposer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  commentInput: { flex: 1, minHeight: 38, borderWidth: 1, borderColor: "#26344D", borderRadius: 10, paddingHorizontal: 10, color: "#F4F7FF", fontSize: 11 },
  commentSend: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: "#244F91" },
  commentSendText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  guestWrap: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#070A12", gap: 12 },
  primaryButton: { minHeight: 44, borderRadius: 12, backgroundColor: "#244F91", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  secondaryButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#315B89", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10 },
  secondaryButtonText: { color: "#B6D6FF", fontSize: 9, fontWeight: "900", letterSpacing: 0.7, textAlign: "center" },
  createScreen: { flex: 1, backgroundColor: "#070A12", padding: 16, gap: 12 },
  captionInput: { minHeight: 180, maxHeight: 280, borderWidth: 1, borderColor: "#26344D", borderRadius: 14, backgroundColor: "#0D1322", color: "#F4F7FF", padding: 14, fontSize: 14, lineHeight: 21 },
  characterCount: { color: "#71809A", fontSize: 10, textAlign: "right", marginTop: -6 },
  fieldLabel: { color: "#8CA6CC", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  visibilityRow: { flexDirection: "row", gap: 8 },
  visibilityOption: { borderWidth: 1, borderColor: "#26344D", borderRadius: 18, paddingHorizontal: 15, paddingVertical: 9 },
  visibilitySelected: { backgroundColor: "#17345D", borderColor: "#477CC9" },
  visibilityText: { color: "#9BAAC2", fontSize: 11, fontWeight: "700" },
  visibilityTextSelected: { color: "#FFFFFF" },
  helperText: { color: "#7F90AA", fontSize: 10, lineHeight: 16 },
  disabledButton: { opacity: 0.45 },
});
