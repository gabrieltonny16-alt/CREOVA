import React,{useState} from "react";
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {supabase} from "../../lib/supabase";
type Props={onDone:()=>void};
export default function PasswordUpdateScreen({onDone}:Props){
 const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");
 const [loading,setLoading]=useState(false);const [error,setError]=useState("");const [done,setDone]=useState(false);
 const submit=async()=>{
  setError("");
  if(password.length<12){setError("Use at least 12 characters.");return;}
  if(password!==confirm){setError("Your passwords do not match.");return;}
  setLoading(true);
  try{const {error:updateError}=await supabase.auth.updateUser({password});if(updateError)throw updateError;setDone(true);}
  catch(e){setError(e instanceof Error?e.message:"Password could not be updated. Request a new reset link.");}
  finally{setLoading(false);}
 };
 return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==="ios"?"padding":undefined}>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Text style={s.brand}>CREOVA</Text><Text style={s.tagline}>CREATE. CONNECT. EVOLVE.</Text>
   <Text style={s.title}>{done?"Password updated":"Choose a new password"}</Text>
   {done?<><Text style={s.subtitle}>Your password has been changed successfully.</Text><Pressable onPress={onDone} style={s.button}><Text style={s.buttonText}>CONTINUE</Text></Pressable></>:
    <><Text style={s.subtitle}>Use at least 12 characters and keep it unique to CREOVA.</Text>
     <Text style={s.label}>NEW PASSWORD</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 12 characters" placeholderTextColor="#71809A" style={s.input} autoCapitalize="none"/>
     <Text style={s.label}>CONFIRM PASSWORD</Text><TextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Enter it again" placeholderTextColor="#71809A" style={s.input} autoCapitalize="none"/>
     {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
     <Pressable onPress={submit} disabled={loading} style={[s.button,loading&&s.disabled]}><Text style={s.buttonText}>{loading?"UPDATING…":"UPDATE PASSWORD"}</Text></Pressable>
    </>}
  </ScrollView>
 </KeyboardAvoidingView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:"#070A12"},content:{padding:22,paddingTop:30},brand:{color:"#F4F7FF",fontSize:25,fontWeight:"900",letterSpacing:4},tagline:{color:"#8295BA",fontSize:9,fontWeight:"700",letterSpacing:2,marginTop:4},
 title:{color:"#FFFFFF",fontSize:27,fontWeight:"800",marginTop:30},subtitle:{color:"#A4B2CA",fontSize:13,lineHeight:20,marginTop:8,marginBottom:24},
 label:{color:"#B8C8E4",fontSize:10,fontWeight:"800",letterSpacing:1.4,marginBottom:7,marginTop:14},
 input:{minHeight:52,borderRadius:12,borderWidth:1,borderColor:"#263653",backgroundColor:"#0D1423",color:"#FFFFFF",paddingHorizontal:15,fontSize:14},
 error:{color:"#FF9AA8",fontSize:12,marginTop:12},button:{minHeight:52,borderRadius:14,backgroundColor:"#28599E",alignItems:"center",justifyContent:"center",marginTop:22,borderWidth:1,borderColor:"#4D83CC"},
 buttonText:{color:"#FFFFFF",fontSize:12,fontWeight:"900",letterSpacing:1.4},disabled:{opacity:0.55}});
