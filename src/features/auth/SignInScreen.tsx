import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";

type Props = { onBack: () => void };

export default function SignInScreen({ onBack }: Props) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false); const [loading,setLoading]=useState(false);
  const [recovery,setRecovery]=useState(false); const [notice,setNotice]=useState(""); const [error,setError]=useState("");

  const submit=async()=>{
    setError("");setNotice("");
    if(!email.trim()||(!recovery&&!password)){setError("Enter your email address and password.");return;}
    setLoading(true);
    try{
      if(recovery){
        const {error:requestError}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:"creova://auth/callback"});
        if(requestError)throw requestError;
        setNotice("If an account exists for that address, a password-reset link will be sent.");
      }else{
        const {error:signInError}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
        if(signInError)throw signInError;
      }
    }catch(e){setError(e instanceof Error?e.message:"We couldn't complete that request. Try again.");}
    finally{setLoading(false);}
  };

  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==="ios"?"padding":undefined}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} accessibilityRole="button" style={s.back}><Text style={s.backText}>‹  BACK</Text></Pressable>
      <Text style={s.brand}>CREOVA</Text><Text style={s.tagline}>CREATE. CONNECT. EVOLVE.</Text>
      <Text style={s.title}>{recovery?"Reset your password":"Welcome back"}</Text>
      <Text style={s.subtitle}>{recovery?"Enter your account email to request a secure reset link.":"Sign in to continue to your CREOVA account."}</Text>
      <View style={s.field}><Text style={s.label}>EMAIL ADDRESS</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#71809A"
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={s.input} accessibilityLabel="Email address"/>
      </View>
      {!recovery?<View style={s.field}><Text style={s.label}>PASSWORD</Text><View style={s.passwordRow}>
        <TextInput value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor="#71809A"
          secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} style={s.passwordInput} accessibilityLabel="Password"/>
        <Pressable onPress={()=>setShowPassword(!showPassword)} style={s.show}><Text style={s.showText}>{showPassword?"HIDE":"SHOW"}</Text></Pressable>
      </View></View>:null}
      {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
      {notice?<Text accessibilityRole="alert" style={s.notice}>{notice}</Text>:null}
      <Pressable onPress={submit} disabled={loading} accessibilityRole="button" style={[s.submit,loading&&s.disabled]}>
        <Text style={s.submitText}>{loading?"PLEASE WAIT…":recovery?"SEND RESET LINK":"SIGN IN"}</Text>
      </Pressable>
      <Pressable onPress={()=>{setRecovery(!recovery);setError("");setNotice("");}} style={s.secondary}>
        <Text style={s.secondaryText}>{recovery?"Return to sign in":"Forgot password?"}</Text>
      </Pressable>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#070A12"},content:{paddingHorizontal:22,paddingTop:12,paddingBottom:32},
  back:{alignSelf:"flex-start",paddingVertical:10,paddingRight:18},backText:{color:"#8CB8FF",fontSize:12,fontWeight:"800",letterSpacing:1},
  brand:{color:"#F4F7FF",fontSize:25,fontWeight:"900",letterSpacing:4,marginTop:16},tagline:{color:"#8295BA",fontSize:9,fontWeight:"700",letterSpacing:2,marginTop:4},
  title:{color:"#FFFFFF",fontSize:27,fontWeight:"800",marginTop:30},subtitle:{color:"#A4B2CA",fontSize:13,lineHeight:20,marginTop:8,marginBottom:24},
  field:{marginBottom:16},label:{color:"#B8C8E4",fontSize:10,fontWeight:"800",letterSpacing:1.4,marginBottom:8},
  input:{minHeight:52,borderRadius:13,borderWidth:1,borderColor:"#263653",backgroundColor:"#0D1423",color:"#FFFFFF",paddingHorizontal:15,fontSize:14},
  passwordRow:{minHeight:52,borderRadius:13,borderWidth:1,borderColor:"#263653",backgroundColor:"#0D1423",flexDirection:"row",alignItems:"center"},
  passwordInput:{flex:1,minHeight:50,color:"#FFFFFF",paddingHorizontal:15,fontSize:14},show:{paddingHorizontal:13,paddingVertical:12},
  showText:{color:"#8CB8FF",fontSize:10,fontWeight:"900",letterSpacing:1},error:{color:"#FF9AA8",fontSize:12,lineHeight:18,marginTop:8},
  notice:{color:"#B6D6FF",fontSize:12,lineHeight:18,marginTop:8},submit:{minHeight:54,borderRadius:15,backgroundColor:"#28599E",alignItems:"center",justifyContent:"center",marginTop:22,borderWidth:1,borderColor:"#4D83CC"},
  disabled:{opacity:0.55},submitText:{color:"#FFFFFF",fontSize:12,fontWeight:"900",letterSpacing:1.6},secondary:{alignSelf:"center",padding:14},
  secondaryText:{color:"#8CB8FF",fontSize:12,fontWeight:"700"}
});
