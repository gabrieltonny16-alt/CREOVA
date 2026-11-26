import React,{useState} from "react";
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {supabase} from "../../lib/supabase";

type Props={onBack:()=>void};
type Errors=Partial<Record<"name"|"username"|"email"|"password"|"confirmPassword"|"terms",string>>;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// This matches the live public.profiles username constraint exactly.
const usernamePattern=/^[a-z0-9_]{3,24}$/;

export default function RegistrationScreen({onBack}:Props){
 const [name,setName]=useState("");const [username,setUsername]=useState("");const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");const [confirmPassword,setConfirmPassword]=useState("");
 const [acceptedTerms,setAcceptedTerms]=useState(false);const [showPassword,setShowPassword]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);const [errors,setErrors]=useState<Errors>({});
 const [notice,setNotice]=useState("");const [loading,setLoading]=useState(false);const [submittedEmail,setSubmittedEmail]=useState("");

 const submit=async()=>{
  const next:Errors={};
  if(name.trim().length<2||name.trim().length>60)next.name="Enter a name between 2 and 60 characters.";
  if(!usernamePattern.test(username.trim()))next.username="Use 3–24 lowercase letters, numbers or underscores.";
  if(!emailPattern.test(email.trim()))next.email="Enter a valid email address.";
  if(password.length<12)next.password="Use at least 12 characters.";
  if(!confirmPassword||confirmPassword!==password)next.confirmPassword="Your passwords do not match.";
  if(!acceptedTerms)next.terms="You must accept the terms to continue.";
  setErrors(next);setNotice("");if(Object.keys(next).length)return;
  setLoading(true);
  try{
   const {data,error}=await supabase.auth.signUp({
    email:email.trim().toLowerCase(),password,
    options:{data:{username:username.trim().toLowerCase(),display_name:name.trim()},emailRedirectTo:"creova://auth/callback"}
   });
   if(error)throw error;
   if(data.session)setNotice("Your account was created and you are signed in.");
   else{setSubmittedEmail(email.trim());setNotice("Your account details were accepted. Check your email for the verification link before signing in.");}
  }catch(e){setNotice(e instanceof Error?e.message:"We couldn't create the account. Please try again.");}
  finally{setLoading(false);}
 };

 const field=(label:string,value:string,change:(v:string)=>void,placeholder:string,error?:string,keyboardType:"default"|"email-address"="default",autoCapitalize:"none"|"words"="none")=>
  <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={v=>{change(label==="USERNAME"?v.toLowerCase():v);setNotice("");}}
   placeholder={placeholder} placeholderTextColor="#71809A" style={[s.input,error? s.inputError:null]} selectionColor="#8CB8FF"
   keyboardType={keyboardType} autoCapitalize={autoCapitalize} autoCorrect={false} accessibilityLabel={label}/>
   {error?<Text style={s.error}>{error}</Text>:null}</View>;

 return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==="ios"?"padding":undefined}>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Pressable onPress={onBack} accessibilityRole="button" style={s.back}><Text style={s.backText}>‹  BACK</Text></Pressable>
   <Text style={s.brand}>CREOVA</Text><Text style={s.tagline}>CREATE. CONNECT. EVOLVE.</Text>
   <Text style={s.title}>Create your account</Text><Text style={s.subtitle}>Choose your name and a unique username to get started.</Text>
   {field("FULL NAME",name,setName,"Your name",errors.name,"default","words")}
   {field("USERNAME",username,setUsername,"Choose a username",errors.username)}
   {field("EMAIL ADDRESS",email,setEmail,"you@example.com",errors.email,"email-address")}
   <View style={s.field}><Text style={s.label}>PASSWORD</Text><View style={s.passwordRow}>
    <TextInput value={password} onChangeText={v=>{setPassword(v);setNotice("");}} placeholder="At least 12 characters" placeholderTextColor="#71809A"
     style={s.passwordInput} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Password"/>
    <Pressable onPress={()=>setShowPassword(!showPassword)} style={s.show}><Text style={s.showText}>{showPassword?"HIDE":"SHOW"}</Text></Pressable>
   </View>{errors.password?<Text style={s.error}>{errors.password}</Text>:null}</View>
   <View style={s.field}><Text style={s.label}>CONFIRM PASSWORD</Text><View style={s.passwordRow}>
    <TextInput value={confirmPassword} onChangeText={v=>{setConfirmPassword(v);setNotice("");}} placeholder="Enter your password again" placeholderTextColor="#71809A"
     style={s.passwordInput} secureTextEntry={!showConfirm} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Confirm password"/>
    <Pressable onPress={()=>setShowConfirm(!showConfirm)} style={s.show}><Text style={s.showText}>{showConfirm?"HIDE":"SHOW"}</Text></Pressable>
   </View>{errors.confirmPassword?<Text style={s.error}>{errors.confirmPassword}</Text>:null}</View>
   <Pressable onPress={()=>{setAcceptedTerms(!acceptedTerms);setNotice("");}} accessibilityRole="checkbox" accessibilityState={{checked:acceptedTerms}} style={s.termsRow}>
    <View style={[s.checkbox,acceptedTerms?s.checkboxChecked:null]}>{acceptedTerms?<Text style={s.checkmark}>✓</Text>:null}</View>
    <Text style={s.termsText}>I agree to CREOVA's Terms and Privacy Policy.</Text>
   </Pressable>{errors.terms?<Text style={s.error}>{errors.terms}</Text>:null}
   <Pressable onPress={submit} disabled={loading} accessibilityRole="button" style={[s.submit,loading&&s.disabled]}>
    <Text style={s.submitText}>{loading?"CREATING ACCOUNT…":"CREATE ACCOUNT"}</Text>
   </Pressable>
   {notice?<View accessibilityRole="alert" style={s.notice}><Text style={s.noticeText}>{notice}</Text>{submittedEmail?<Text style={s.email}>{submittedEmail}</Text>:null}</View>:null}
   <Text style={s.privacy}>Your password is handled by CREOVA's authentication service, not stored in your public profile.</Text>
  </ScrollView>
 </KeyboardAvoidingView>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:"#070A12"},content:{paddingHorizontal:22,paddingTop:12,paddingBottom:32},
 back:{alignSelf:"flex-start",paddingVertical:10,paddingRight:18},backText:{color:"#8CB8FF",fontSize:12,fontWeight:"800",letterSpacing:1},
 brand:{color:"#F4F7FF",fontSize:25,fontWeight:"900",letterSpacing:4,marginTop:16},tagline:{color:"#8295BA",fontSize:9,fontWeight:"700",letterSpacing:2,marginTop:4},
 title:{color:"#FFFFFF",fontSize:27,fontWeight:"800",marginTop:26},subtitle:{color:"#A4B2CA",fontSize:13,lineHeight:20,marginTop:8,marginBottom:20},
 field:{marginBottom:14},label:{color:"#B8C8E4",fontSize:10,fontWeight:"800",letterSpacing:1.4,marginBottom:7},
 input:{minHeight:50,borderRadius:12,borderWidth:1,borderColor:"#263653",backgroundColor:"#0D1423",color:"#FFFFFF",paddingHorizontal:15,fontSize:14},
 passwordRow:{minHeight:50,borderRadius:12,borderWidth:1,borderColor:"#263653",backgroundColor:"#0D1423",flexDirection:"row",alignItems:"center"},
 passwordInput:{flex:1,minHeight:48,color:"#FFFFFF",paddingHorizontal:15,fontSize:14},show:{paddingHorizontal:13,paddingVertical:12},
 showText:{color:"#8CB8FF",fontSize:10,fontWeight:"900",letterSpacing:1},inputError:{borderColor:"#D66A79"},
 error:{color:"#FF9AA8",fontSize:11,lineHeight:16,marginTop:5},termsRow:{flexDirection:"row",alignItems:"center",marginTop:4,marginBottom:5},
 checkbox:{width:21,height:21,borderRadius:6,borderWidth:1,borderColor:"#58739E",alignItems:"center",justifyContent:"center",marginRight:10},
 checkboxChecked:{backgroundColor:"#2B5DA4",borderColor:"#75A8F5"},checkmark:{color:"#FFFFFF",fontSize:14,fontWeight:"900"},
 termsText:{color:"#B6C4DE",fontSize:12,flex:1},submit:{minHeight:52,borderRadius:14,backgroundColor:"#28599E",alignItems:"center",justifyContent:"center",marginTop:18,borderWidth:1,borderColor:"#4D83CC"},
 disabled:{opacity:0.55},submitText:{color:"#FFFFFF",fontSize:12,fontWeight:"900",letterSpacing:1.4},
 notice:{marginTop:14,borderRadius:12,padding:13,backgroundColor:"#10233B",borderWidth:1,borderColor:"#315B89"},
 noticeText:{color:"#D5E2F6",fontSize:12,lineHeight:18},email:{color:"#9FC4FF",fontSize:12,fontWeight:"700",marginTop:6},
 privacy:{color:"#71809A",fontSize:10,lineHeight:16,marginTop:16,textAlign:"center"}
});
