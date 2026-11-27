import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";

type Profile = { username: string; display_name: string; bio: string; is_private: boolean };
type Props = { userId: string; email?: string; onSignOut: () => void };

export default function ProfileScreen({ userId, email, onSignOut }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [posts, setPosts] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const [profileResult, postCount, followerCount, followingCount] = await Promise.all([
        supabase.from("profiles").select("username,display_name,bio,is_private").eq("id", userId).single(),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId),
        supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId).eq("status", "accepted"),
        supabase.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId).eq("status", "accepted"),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (postCount.error) throw postCount.error;
      if (followerCount.error) throw followerCount.error;
      if (followingCount.error) throw followingCount.error;
      const row = profileResult.data as Profile;
      setProfile(row);
      setDisplayName(row.display_name);
      setBio(row.bio);
      setIsPrivate(row.is_private);
      setPosts(postCount.count ?? 0);
      setFollowers(followerCount.count ?? 0);
      setFollowing(followingCount.count ?? 0);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your profile couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const saveProfile = async () => {
    const cleanName = displayName.trim();
    const cleanBio = bio.trim();
    if (!cleanName || cleanName.length > 60 || cleanBio.length > 160) {
      setNotice("Display name must be 1–60 characters and bio up to 160 characters.");
      return;
    }
    setSaving(true);
    setNotice("");
    const { error } = await supabase.from("profiles").update({ display_name: cleanName, bio: cleanBio, is_private: isPrivate, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) setNotice(error.message);
    else {
      setProfile((current) => current ? { ...current, display_name: cleanName, bio: cleanBio, is_private: isPrivate } : current);
      setNotice("Profile saved.");
    }
    setSaving(false);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#8CB8FF" /></View>;
  if (!profile) return <View style={styles.screen}><Text style={styles.notice}>{notice || "Profile unavailable."}</Text><Pressable onPress={() => void loadProfile()} style={styles.action}><Text style={styles.actionText}>TRY AGAIN</Text></Pressable></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.heading}><View><Text style={styles.eyebrow}>YOUR ACCOUNT</Text><Text style={styles.title}>Profile</Text></View><Pressable onPress={() => void loadProfile()} style={styles.refresh}><Text style={styles.refreshText}>REFRESH</Text></Pressable></View>
      <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{profile.display_name.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{profile.display_name}</Text><Text style={styles.username}>@{profile.username}</Text>{email ? <Text style={styles.email}>{email}</Text> : null}</View></View>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statNumber}>{posts}</Text><Text style={styles.statLabel}>POSTS</Text></View>
        <View style={styles.stat}><Text style={styles.statNumber}>{followers}</Text><Text style={styles.statLabel}>FOLLOWERS</Text></View>
        <View style={styles.stat}><Text style={styles.statNumber}>{following}</Text><Text style={styles.statLabel}>FOLLOWING</Text></View>
      </View>
      <Text style={styles.section}>EDIT PROFILE</Text>
      <Text style={styles.label}>DISPLAY NAME</Text>
      <TextInput value={displayName} onChangeText={setDisplayName} maxLength={60} style={styles.input} placeholder="Your display name" placeholderTextColor="#71809A" />
      <Text style={styles.label}>BIO · {bio.length}/160</Text>
      <TextInput value={bio} onChangeText={setBio} maxLength={160} multiline style={[styles.input, styles.bioInput]} placeholder="Tell people about yourself" placeholderTextColor="#71809A" />
      <Pressable onPress={() => setIsPrivate((value) => !value)} accessibilityRole="switch" accessibilityState={{ checked: isPrivate }} style={styles.privacyRow}>
        <View style={{ flex: 1 }}><Text style={styles.privacyTitle}>Private account</Text><Text style={styles.privacyHint}>{isPrivate ? "Only approved followers can see follower-only content." : "Your public posts can be discovered by everyone."}</Text></View>
        <View style={[styles.switch, isPrivate && styles.switchOn]}><View style={[styles.switchKnob, isPrivate && styles.switchKnobOn]} /></View>
      </Pressable>
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      <Pressable disabled={saving} onPress={() => void saveProfile()} style={styles.action}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionText}>SAVE PROFILE</Text>}</Pressable>
      <Pressable onPress={onSignOut} style={styles.signOut}><Text style={styles.signOutText}>SIGN OUT</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070A12", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#070A12" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "#6E9FFF", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#F4F7FF", fontSize: 25, fontWeight: "800", marginTop: 3 },
  refresh: { borderWidth: 1, borderColor: "#315B89", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  refreshText: { color: "#B6D6FF", fontSize: 9, fontWeight: "900" },
  identity: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1C355C", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#D7E7FF", fontSize: 22, fontWeight: "900" },
  name: { color: "#F4F7FF", fontSize: 16, fontWeight: "800" },
  username: { color: "#8B9AB4", fontSize: 11, marginTop: 2 },
  email: { color: "#71809A", fontSize: 10, marginTop: 3 },
  stats: { flexDirection: "row", paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#1A2235" },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statNumber: { color: "#F4F7FF", fontSize: 16, fontWeight: "900" },
  statLabel: { color: "#7F90AA", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  section: { color: "#8CA6CC", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 4 },
  label: { color: "#8CA6CC", fontSize: 9, fontWeight: "900", letterSpacing: 0.8, marginTop: 3 },
  input: { minHeight: 42, borderWidth: 1, borderColor: "#26344D", borderRadius: 10, paddingHorizontal: 11, color: "#F4F7FF", backgroundColor: "#0D1322", fontSize: 12 },
  bioInput: { minHeight: 64, paddingTop: 10, textAlignVertical: "top" },
  privacyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  privacyTitle: { color: "#E5ECF8", fontSize: 12, fontWeight: "800" },
  privacyHint: { color: "#7F90AA", fontSize: 9, lineHeight: 14, marginTop: 2 },
  switch: { width: 40, height: 23, borderRadius: 12, backgroundColor: "#29364B", padding: 3, justifyContent: "center" },
  switchOn: { backgroundColor: "#315B89" },
  switchKnob: { width: 17, height: 17, borderRadius: 9, backgroundColor: "#D8E4F6" },
  switchKnobOn: { alignSelf: "flex-end", backgroundColor: "#FFFFFF" },
  notice: { color: "#9FC2F6", fontSize: 10, lineHeight: 15 },
  action: { minHeight: 42, borderRadius: 11, backgroundColor: "#244F91", alignItems: "center", justifyContent: "center", padding: 10 },
  actionText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  signOut: { alignSelf: "center", paddingVertical: 8 },
  signOutText: { color: "#B6D6FF", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
});
