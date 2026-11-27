import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";

type Creator = { id: string; username: string; display_name: string; bio: string; avatar_url: string | null; is_private: boolean };
type FollowState = "accepted" | "pending" | "rejected";

type Props = { userId: string | null; onSignIn: () => void; onJoin: () => void };

export default function ExploreScreen({ userId, onSignIn, onJoin }: Props) {
  const [query, setQuery] = useState("");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [followStates, setFollowStates] = useState<Record<string, FollowState>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const searchCreators = useCallback(async (term = query, refresh = false) => {
    if (!userId) { setCreators([]); setLoading(false); return; }
    setLoading(!refresh);
    setRefreshing(refresh);
    setNotice("");
    try {
      let request = supabase.from("profiles").select("id,username,display_name,bio,avatar_url,is_private").neq("id", userId).order("created_at", { ascending: false }).limit(25);
      const clean = term.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ");
      if (clean.length >= 2) request = request.or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`);
      const { data, error } = await request;
      if (error) throw error;
      const rows = (data ?? []) as Creator[];
      setCreators(rows);
      if (rows.length) {
        const { data: follows, error: followError } = await supabase.from("user_follows").select("following_id,status").eq("follower_id", userId).in("following_id", rows.map((row) => row.id));
        if (followError) throw followError;
        const next: Record<string, FollowState> = {};
        for (const relation of follows ?? []) next[relation.following_id] = relation.status as FollowState;
        setFollowStates(next);
      } else setFollowStates({});
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Creator search couldn't be completed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, query]);

  useEffect(() => { void searchCreators(query); }, [userId]);

  const toggleFollow = async (creator: Creator) => {
    if (!userId || busyId) return;
    setBusyId(creator.id);
    setNotice("");
    const current = followStates[creator.id];
    try {
      if (current === "accepted" || current === "pending" || current === "rejected") {
        const { error } = await supabase.from("user_follows").delete().eq("follower_id", userId).eq("following_id", creator.id);
        if (error) throw error;
      }
      if (current !== "accepted" && current !== "pending") {
        const { error } = await supabase.from("user_follows").insert({
          follower_id: userId,
          following_id: creator.id,
          status: creator.is_private ? "pending" : "accepted",
        });
        if (error) throw error;
        setFollowStates((value) => ({ ...value, [creator.id]: creator.is_private ? "pending" : "accepted" }));
      } else {
        setFollowStates((value) => { const next = { ...value }; delete next[creator.id]; return next; });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That follow action couldn't be saved.");
      await searchCreators(query, true);
    } finally {
      setBusyId(null);
    }
  };

  if (!userId) return (
    <View style={styles.guest}>
      <Text style={styles.eyebrow}>CREATOR DISCOVERY</Text>
      <Text style={styles.title}>Explore CREOVA</Text>
      <Text style={styles.body}>Sign in to search for creators and follow the people you want to see in your feed.</Text>
      <Pressable onPress={onJoin} style={styles.primary}><Text style={styles.primaryText}>CREATE ACCOUNT</Text></Pressable>
      <Pressable onPress={onSignIn} style={styles.secondary}><Text style={styles.secondaryText}>SIGN IN</Text></Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.heading}><View><Text style={styles.eyebrow}>FIND YOUR COMMUNITY</Text><Text style={styles.title}>Explore</Text></View>
        <Pressable onPress={() => void searchCreators(query, true)} style={styles.refresh}><Text style={styles.refreshText}>REFRESH</Text></Pressable>
      </View>
      <View style={styles.searchRow}>
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void searchCreators(query)} placeholder="Search creators or usernames" placeholderTextColor="#71809A" returnKeyType="search" style={styles.searchInput} accessibilityLabel="Search creators" />
        <Pressable onPress={() => void searchCreators(query)} style={styles.searchButton}><Text style={styles.searchButtonText}>SEARCH</Text></Pressable>
      </View>
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color="#8CB8FF" /></View> : (
        <FlatList
          data={creators}
          keyExtractor={(item) => item.id}
          contentContainerStyle={creators.length ? styles.list : styles.empty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void searchCreators(query, true)} tintColor="#8CB8FF" />}
          ListEmptyComponent={<Text style={styles.body}>{query.trim().length >= 2 ? "No creators matched that search." : "No creators to show yet."}</Text>}
          renderItem={({ item }) => {
            const state = followStates[item.id];
            const label = state === "accepted" ? "FOLLOWING" : state === "pending" ? "REQUESTED" : creatorButtonLabel(item);
            return (
              <View style={styles.creatorRow}>
                {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{item.display_name.slice(0, 1).toUpperCase()}</Text></View>}
                <View style={styles.creatorInfo}>
                  <Text style={styles.creatorName}>{item.display_name}</Text>
                  <Text style={styles.username}>@{item.username}{item.is_private ? " · PRIVATE" : ""}</Text>
                  {item.bio ? <Text numberOfLines={2} style={styles.bio}>{item.bio}</Text> : null}
                </View>
                <Pressable disabled={busyId === item.id} onPress={() => void toggleFollow(item)} style={[styles.followButton, state === "accepted" && styles.followingButton]}>
                  {busyId === item.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.followText}>{label}</Text>}
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function creatorButtonLabel(creator: Creator) { return creator.is_private ? "REQUEST" : "FOLLOW"; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070A12" },
  heading: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "#6E9FFF", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#F4F7FF", fontSize: 25, fontWeight: "800", marginTop: 3 },
  refresh: { borderWidth: 1, borderColor: "#315B89", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  refreshText: { color: "#B6D6FF", fontSize: 9, fontWeight: "900" },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  searchInput: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: "#26344D", borderRadius: 11, paddingHorizontal: 12, color: "#F4F7FF", backgroundColor: "#0D1322", fontSize: 12 },
  searchButton: { backgroundColor: "#244F91", borderRadius: 11, paddingHorizontal: 13, justifyContent: "center" },
  searchButtonText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  notice: { color: "#F0B7A8", fontSize: 11, paddingHorizontal: 16, paddingVertical: 5 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 14, paddingBottom: 20 },
  empty: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1A2235" },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#14213A" },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#1C355C", alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#D7E7FF", fontSize: 15, fontWeight: "900" },
  creatorInfo: { flex: 1 },
  creatorName: { color: "#F4F7FF", fontSize: 12, fontWeight: "800" },
  username: { color: "#8B9AB4", fontSize: 10, marginTop: 2 },
  bio: { color: "#B4C0D3", fontSize: 10, lineHeight: 15, marginTop: 4 },
  followButton: { minWidth: 76, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: "#244F91" },
  followingButton: { backgroundColor: "#18263D", borderWidth: 1, borderColor: "#3A5378" },
  followText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  guest: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#070A12" },
  body: { color: "#A4B2CA", fontSize: 12, lineHeight: 19 },
  primary: { minHeight: 44, borderRadius: 12, backgroundColor: "#244F91", alignItems: "center", justifyContent: "center", padding: 12 },
  primaryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  secondary: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#315B89", alignItems: "center", justifyContent: "center", padding: 10 },
  secondaryText: { color: "#B6D6FF", fontSize: 9, fontWeight: "900" },
});
