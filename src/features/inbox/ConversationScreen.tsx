import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type Message = { id: string; sender_id: string; body: string | null; created_at: string; edited_at: string | null; deleted_at: string | null; sender_name: string };
type Props = { conversationId: string; userId: string; title: string; onBack: () => void };

export default function ConversationScreen({ conversationId, userId, title, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const listRef = useRef<FlatList<Message>>(null);

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase.from("conversation_messages")
      .select("id,sender_id,body,created_at,edited_at,deleted_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) { setNotice(error.message); setLoading(false); return; }
    const senderIds = [...new Set((data ?? []).map((message) => message.sender_id))];
    const { data: profiles, error: profileError } = senderIds.length
      ? await supabase.from("profiles").select("id,display_name").in("id", senderIds)
      : { data: [], error: null };
    if (profileError) setNotice(profileError.message);
    const names = new Map((profiles ?? []).map((person) => [person.id, person.display_name]));
    setMessages((data ?? []).map((message) => ({ ...message, sender_name: names.get(message.sender_id) ?? "CREOVA member" })) as Message[]);
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
  }, [conversationId]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    void loadMessages().then(() => {
      channel = supabase.channel(`conversation:${conversationId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${conversationId}` }, () => { void loadMessages(); })
        .subscribe();
    });
    void supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", userId);
    return () => { if (channel) void supabase.removeChannel(channel); };
  }, [conversationId, userId, loadMessages]);

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setNotice("");
    const { error } = await supabase.from("conversation_messages").insert({ conversation_id: conversationId, sender_id: userId, body });
    if (error) setNotice(error.message);
    else { setDraft(""); await loadMessages(); }
    setSending(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.rpc("creova_edit_conversation_message", { p_message_id: editingId, p_body: editDraft });
    if (error) setNotice(error.message);
    else { setEditingId(null); setEditDraft(""); await loadMessages(); }
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase.rpc("creova_delete_conversation_message", { p_message_id: messageId });
    if (error) setNotice(error.message);
    else await loadMessages();
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#8CB8FF" /></View>;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ BACK</Text></Pressable>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <View style={{ width: 54 }} />
      </View>
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      <FlatList ref={listRef} data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.messageList}
        ListEmptyComponent={<Text style={styles.empty}>This is the beginning of your conversation.</Text>}
        renderItem={({ item }) => {
          const mine = item.sender_id === userId;
          return <View style={[styles.messageRow, mine && styles.mineRow]}>
            <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble]}>
              {!mine ? <Text style={styles.sender}>{item.sender_name}</Text> : null}
              {editingId === item.id ? (
                <View style={{ gap: 7 }}>
                  <TextInput value={editDraft} onChangeText={setEditDraft} multiline style={styles.editInput} />
                  <View style={styles.messageActions}><Pressable onPress={() => void saveEdit()}><Text style={styles.actionText}>SAVE</Text></Pressable><Pressable onPress={() => setEditingId(null)}><Text style={styles.mutedAction}>CANCEL</Text></Pressable></View>
                </View>
              ) : <Text style={styles.body}>{item.deleted_at ? "Message deleted" : item.body}</Text>}
              <View style={styles.metaRow}><Text style={styles.meta}>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{item.edited_at && !item.deleted_at ? " · edited" : ""}</Text>
                {mine && !item.deleted_at && editingId !== item.id ? <View style={styles.messageActions}>
                  <Pressable onPress={() => { setEditingId(item.id); setEditDraft(item.body ?? ""); }}><Text style={styles.mutedAction}>EDIT</Text></Pressable>
                  <Pressable onPress={() => void deleteMessage(item.id)}><Text style={styles.mutedAction}>DELETE</Text></Pressable>
                </View> : null}
              </View>
            </View>
          </View>;
        }}
      />
      <View style={styles.composer}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Write a message…" placeholderTextColor="#71809A" multiline maxLength={5000} style={styles.input} />
        <Pressable disabled={sending || !draft.trim()} onPress={() => void sendMessage()} style={[styles.send, (!draft.trim() || sending) && styles.disabled]}>
          {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.sendText}>SEND</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
 screen:{flex:1,backgroundColor:"#070A12"},loading:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#070A12"},
 header:{minHeight:48,paddingHorizontal:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#1A2235"},
 back:{minWidth:54},backText:{color:"#8CB8FF",fontSize:10,fontWeight:"900"},title:{color:"#F4F7FF",fontSize:13,fontWeight:"800",flex:1,textAlign:"center"},
 notice:{color:"#F0B7A8",fontSize:10,paddingHorizontal:12,paddingVertical:5},messageList:{padding:12,gap:10,flexGrow:1,justifyContent:"flex-end"},
 empty:{color:"#71809A",fontSize:11,textAlign:"center",marginVertical:30},messageRow:{flexDirection:"row",justifyContent:"flex-start"},mineRow:{justifyContent:"flex-end"},
 bubble:{maxWidth:"86%",borderRadius:15,paddingHorizontal:11,paddingTop:8,paddingBottom:6},mineBubble:{backgroundColor:"#1B3D6C",borderBottomRightRadius:4},theirBubble:{backgroundColor:"#111B2B",borderBottomLeftRadius:4},
 sender:{color:"#8CB8FF",fontSize:9,fontWeight:"900",marginBottom:4},body:{color:"#F4F7FF",fontSize:12,lineHeight:18},metaRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:5},
 meta:{color:"#8FA4C5",fontSize:8},messageActions:{flexDirection:"row",gap:10},mutedAction:{color:"#A8C6F3",fontSize:8,fontWeight:"800"},actionText:{color:"#FFFFFF",fontSize:9,fontWeight:"900"},
 editInput:{minWidth:170,color:"#FFFFFF",fontSize:12,borderWidth:1,borderColor:"#5576A6",borderRadius:7,padding:7},composer:{flexDirection:"row",alignItems:"flex-end",gap:8,padding:10,borderTopWidth:1,borderTopColor:"#1A2235"},
 input:{flex:1,maxHeight:110,minHeight:42,borderWidth:1,borderColor:"#26344D",borderRadius:13,paddingHorizontal:12,paddingVertical:10,color:"#F4F7FF",backgroundColor:"#0D1322",fontSize:12},
 send:{minHeight:42,minWidth:58,alignItems:"center",justifyContent:"center",borderRadius:12,backgroundColor:"#244F91",paddingHorizontal:10},sendText:{color:"#FFFFFF",fontSize:9,fontWeight:"900"},disabled:{opacity:.45}
});
