import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";

type Person = { id: string; username: string; display_name: string; avatar_url: string | null };
type Thread = { id: string; kind: "direct" | "group"; title: string | null; last_message_at: string; members: Person[]; preview: string; pending?: boolean };
type Props = { userId: string; onOpenConversation: (conversation: { id: string; title: string }) => void };

export default function InboxScreen({ userId, onOpenConversation }: Props) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [compose, setCompose] = useState(false);
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadInbox = useCallback(async (refresh = false) => {
    setLoading(!refresh);
    setRefreshing(refresh);
    setNotice("");
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from("conversation_members")
        .select("conversation_id,membership_status")
        .eq("user_id", userId)
        .in("membership_status", ["accepted", "pending"]);
      if (membershipError) throw membershipError;
      const rows = memberships ?? [];
      const ids = [...new Set(rows.map((row) => row.conversation_id))];
      if (!ids.length) { setThreads([]); return; }
      const [conversationResult, memberResult, messageResult] = await Promise.all([
        supabase.from("conversations").select("id,kind,title,last_message_at").in("id", ids).order("last_message_at", { ascending: false }),
        supabase.from("conversation_members").select("conversation_id,user_id,membership_status").in("conversation_id", ids).eq("membership_status", "accepted"),
        supabase.from("conversation_messages").select("id,conversation_id,body,deleted_at,created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(Math.min(ids.length * 5, 250))
      ]);
      if (conversationResult.error) throw conversationResult.error;
      if (memberResult.error) throw memberResult.error;
      if (messageResult.error) throw messageResult.error;
      const userIds = [...new Set((memberResult.data ?? []).map((row) => row.user_id))];
      const { data: profiles, error: profileError } = userIds.length
        ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", userIds)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const byId = new Map((profiles ?? []).map((person) => [person.id, person as Person]));
      const memberMap = new Map<string, Person[]>();
      for (const member of memberResult.data ?? []) {
        const person = byId.get(member.user_id);
        if (person) memberMap.set(member.conversation_id, [...(memberMap.get(member.conversation_id) ?? []), person]);
      }
      const previewMap = new Map<string, string>();
      for (const message of messageResult.data ?? []) {
        if (!previewMap.has(message.conversation_id)) previewMap.set(message.conversation_id, message.deleted_at ? "Message deleted" : (message.body ?? "Media attachment"));
      }
      const pendingIds = new Set(rows.filter((row) => row.membership_status === "pending").map((row) => row.conversation_id));
      setThreads((conversationResult.data ?? []).map((conversation) => ({
        ...conversation,
        kind: conversation.kind as "direct" | "group",
        members: memberMap.get(conversation.id) ?? [],
        preview: previewMap.get(conversation.id) ?? "Start the conversation",
        pending: pendingIds.has(conversation.id)
      })));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Inbox couldn't be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { void loadInbox(); }, [loadInbox]);

  const searchPeople = async () => {
    const term = search.trim().replace(/[,%()]/g, " ");
    if (term.length < 2) { setNotice("Enter at least two characters to search."); return; }
    setSearching(true);
    setNotice("");
    const { data, error } = await supabase.from("profiles")
      .select("id,username,display_name,avatar_url")
      .neq("id", userId)
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .order("display_name")
      .limit(20);
    if (error) setNotice(error.message);
    else setPeople((data ?? []) as Person[]);
    setSearching(false);
  };

  const startConversation = async (kind: "direct" | "group") => {
    if (creating || selected.length === 0) return;
    if (kind === "direct" && selected.length !== 1) return;
    const title = groupTitle.trim();
    if (kind === "group" && !title) { setNotice("Add a name for your group."); return; }
    setCreating(true);
    setNotice("");
    const memberIds = [userId, ...selected];
    const { data, error } = await supabase.rpc("creova_create_conversation", {
      p_kind: kind,
      p_member_ids: memberIds,
      p_title: kind === "group" ? title : null
    });
    if (error || !data) {
      setNotice(error?.message ?? "The conversation couldn't be created.");
      setCreating(false);
      return;
    }
    const chosen = people.filter((person) => selected.includes(person.id));
    const conversationName = kind === "group" ? title : (chosen[0]?.display_name ?? "Conversation");
    setCompose(false);
    setSelected([]);
    setPeople([]);
    setSearch("");
    setGroupTitle("");
    setCreating(false);
    await loadInbox(true);
    onOpenConversation({ id: data as string, title: conversationName });
  };

  const acceptInvite = async (thread: Thread) => {
    const { error } = await supabase.from("conversation_members")
      .update({ membership_status: "accepted", accepted_at: new Date().toISOString(), joined_at: new Date().toISOString() })
      .eq("conversation_id", thread.id).eq("user_id", userId).eq("membership_status", "pending");
    if (error) setNotice(error.message);
    else await loadInbox(true);
  };

  const threadTitle = (thread: Thread) => thread.kind === "group"
    ? (thread.title || "Group conversation")
    : (thread.members.find((person) => person.id !== userId)?.display_name ?? "CREOVA member");

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#8CB8FF" /></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <View><Text style={styles.eyebrow}>STAY CONNECTED</Text><Text style={styles.title}>Inbox</Text></View>
        <Pressable onPress={() => { setCompose((value) => !value); setNotice(""); }} style={styles.newButton}><Text style={styles.newText}>{compose ? "CLOSE" : "NEW MESSAGE"}</Text></Pressable>
      </View>
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      {compose ? (
        <View style={styles.composePanel}>
          <Text style={styles.section}>FIND PEOPLE</Text>
          <View style={styles.searchRow}>
            <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => void searchPeople()} placeholder="Search username or name" placeholderTextColor="#71809A" style={styles.searchInput} returnKeyType="search" />
            <Pressable onPress={() => void searchPeople()} style={styles.searchButton}>{searching ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.newText}>SEARCH</Text>}</Pressable>
          </View>
          <Text style={styles.hint}>Select one person for a direct message, or several to create a group.</Text>
          <ScrollView style={styles.peopleList} keyboardShouldPersistTaps="handled">
            {people.map((person) => {
              const active = selected.includes(person.id);
              return <Pressable key={person.id} onPress={() => setSelected((current) => active ? current.filter((id) => id !== person.id) : [...current, person.id])} style={[styles.personRow, active && styles.personSelected]}>
                <View style={styles.personAvatar}><Text style={styles.avatarLetter}>{person.display_name.slice(0,1).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.personName}>{person.display_name}</Text><Text style={styles.hint}>@{person.username}</Text></View>
                <Text style={styles.check}>{active ? "✓" : "+"}</Text>
              </Pressable>;
            })}
          </ScrollView>
          {selected.length > 1 ? <TextInput value={groupTitle} onChangeText={setGroupTitle} placeholder="Group name" placeholderTextColor="#71809A" maxLength={80} style={styles.searchInput} /> : null}
          <View style={styles.createActions}>
            <Pressable disabled={creating || selected.length !== 1} onPress={() => void startConversation("direct")} style={[styles.createAction, selected.length !== 1 && styles.disabled]}><Text style={styles.newText}>MESSAGE · 1</Text></Pressable>
            <Pressable disabled={creating || selected.length < 2} onPress={() => void startConversation("group")} style={[styles.createAction, selected.length < 2 && styles.disabled]}><Text style={styles.newText}>CREATE GROUP · {selected.length}</Text></Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={() => void loadInbox(true)}
          contentContainerStyle={threads.length ? styles.threadList : styles.empty}
          ListEmptyComponent={<Text style={styles.hint}>Your conversations will appear here. Start a message to connect with someone.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => item.pending ? void acceptInvite(item) : onOpenConversation({ id: item.id, title: threadTitle(item) })} style={styles.threadRow}>
              <View style={styles.threadAvatar}><Text style={styles.avatarLetter}>{threadTitle(item).slice(0,1).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={styles.threadTop}><Text style={styles.personName}>{threadTitle(item)}</Text><Text style={styles.time}>{new Date(item.last_message_at).toLocaleDateString()}</Text></View>
                <Text numberOfLines={1} style={styles.preview}>{item.pending ? "Invitation · tap to accept" : item.preview}</Text>
              </View>
              {item.pending ? <Text style={styles.invite}>JOIN</Text> : <Text style={styles.chevron}>›</Text>}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
 screen:{flex:1,backgroundColor:"#070A12"},loading:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#070A12"},
 heading:{paddingHorizontal:16,paddingTop:12,paddingBottom:10,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 eyebrow:{color:"#6E9FFF",fontSize:10,fontWeight:"800",letterSpacing:2},title:{color:"#F4F7FF",fontSize:25,fontWeight:"800",marginTop:3},
 newButton:{borderRadius:10,backgroundColor:"#244F91",paddingHorizontal:12,paddingVertical:10},newText:{color:"#FFFFFF",fontSize:9,fontWeight:"900",letterSpacing:.6},
 notice:{color:"#F0B7A8",fontSize:10,paddingHorizontal:16,paddingBottom:6},threadList:{paddingHorizontal:14,paddingBottom:18},
 empty:{flexGrow:1,justifyContent:"center",alignItems:"center",padding:28},hint:{color:"#8B9AB4",fontSize:10,lineHeight:16},
 threadRow:{flexDirection:"row",alignItems:"center",gap:11,paddingVertical:13,borderBottomWidth:1,borderBottomColor:"#1A2235"},
 threadAvatar:{width:46,height:46,borderRadius:23,backgroundColor:"#1C355C",alignItems:"center",justifyContent:"center"},
 avatarLetter:{color:"#D7E7FF",fontSize:16,fontWeight:"900"},threadTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
 personName:{color:"#F4F7FF",fontSize:12,fontWeight:"800"},time:{color:"#71809A",fontSize:9},preview:{color:"#8B9AB4",fontSize:10,marginTop:5},
 invite:{color:"#8CB8FF",fontSize:9,fontWeight:"900"},chevron:{color:"#71809A",fontSize:22},
 composePanel:{flex:1,paddingHorizontal:14,gap:8},section:{color:"#8CA6CC",fontSize:10,fontWeight:"900",letterSpacing:1.4},
 searchRow:{flexDirection:"row",gap:7},searchInput:{flex:1,minHeight:40,borderWidth:1,borderColor:"#26344D",borderRadius:10,paddingHorizontal:11,color:"#F4F7FF",backgroundColor:"#0D1322",fontSize:11},
 searchButton:{borderRadius:10,backgroundColor:"#244F91",paddingHorizontal:12,alignItems:"center",justifyContent:"center"},peopleList:{flex:1},
 personRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:"#1A2235"},
 personSelected:{backgroundColor:"#101D32"},personAvatar:{width:34,height:34,borderRadius:17,backgroundColor:"#1C355C",alignItems:"center",justifyContent:"center"},
 check:{color:"#8CB8FF",fontSize:19,fontWeight:"900",paddingHorizontal:8},createActions:{flexDirection:"row",gap:8,paddingVertical:8},
 createAction:{flex:1,minHeight:40,backgroundColor:"#244F91",borderRadius:10,alignItems:"center",justifyContent:"center"},disabled:{opacity:.4}
});
