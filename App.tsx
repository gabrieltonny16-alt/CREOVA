import React,{useEffect,useState} from "react";
import {Linking,Pressable,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,View} from "react-native";
import type {Session} from "@supabase/supabase-js";
import RegistrationScreen from "./src/features/auth/RegistrationScreen";
import SignInScreen from "./src/features/auth/SignInScreen";
import PasswordUpdateScreen from "./src/features/auth/PasswordUpdateScreen";
import FeedScreen from "./src/features/feed/FeedScreen";
import ExploreScreen from "./src/features/explore/ExploreScreen";
import ProfileScreen from "./src/features/profile/ProfileScreen";
import {supabase} from "./src/lib/supabase";

type Tab="Home"|"Explore"|"Create"|"Inbox"|"Profile";
const TABS:Tab[]=["Home","Explore","Create","Inbox","Profile"];

export default function App(){
 const [activeTab,setActiveTab]=useState<Tab>("Home");
 const [authScreen,setAuthScreen]=useState<"home"|"register"|"signin">("home");
 const [session,setSession]=useState<Session|null>(null);
 const [authReady,setAuthReady]=useState(false);
 const [passwordRecovery,setPasswordRecovery]=useState(false);
 const [authNotice,setAuthNotice]=useState("");

 useEffect(()=>{
  let mounted=true;
  supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setAuthReady(true);}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,nextSession)=>{
   setSession(nextSession);setAuthReady(true);
   if(event==="PASSWORD_RECOVERY")setPasswordRecovery(true);
   if(event==="SIGNED_IN")setAuthScreen("home");
  });
  const handleUrl=async(url:string|null)=>{
   if(!url)return;
   try{
    const codeMatch=url.match(/[?&]code=([^&#]+)/);
    const code=codeMatch?decodeURIComponent(codeMatch[1]):null;
    if(code){
     const {error}=await supabase.auth.exchangeCodeForSession(code);
     if(error)setAuthNotice("This link could not be completed. Request a fresh link and try again.");
     else setAuthNotice("Your email link has been verified.");
    }
   }catch{setAuthNotice("We couldn't complete this link. Please request a fresh one.");}
  };
  Linking.getInitialURL().then(url=>handleUrl(url??null));
  const linkListener=Linking.addEventListener("url",({url})=>{void handleUrl(url);});
  return()=>{mounted=false;subscription.unsubscribe();linkListener.remove();};
 },[]);

 const signOut=async()=>{
  const {error}=await supabase.auth.signOut();
  if(error)setAuthNotice("Sign out did not complete. Please try again.");
  else{setSession(null);setActiveTab("Home");setAuthNotice("You have signed out.");}
 };

 if(passwordRecovery)return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><PasswordUpdateScreen onDone={()=>{setPasswordRecovery(false);setActiveTab("Profile");}}/></SafeAreaView>;
 if(authScreen==="register")return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><RegistrationScreen onBack={()=>setAuthScreen("home")}/></SafeAreaView>;
 if(authScreen==="signin")return <SafeAreaView style={s.safe}><StatusBar barStyle="light-content"/><SignInScreen onBack={()=>setAuthScreen("home")}/></SafeAreaView>;

 return <SafeAreaView style={s.safe}>
  <StatusBar barStyle="light-content"/>
  <View style={s.app}>
   <View style={s.header}>
    <View><Text style={s.wordmark}>CREOVA</Text><Text style={s.tagline}>CREATE. CONNECT. EVOLVE.</Text></View>
    <View style={s.headerActions}>
     {session?<Pressable onPress={()=>setActiveTab("Profile")} accessibilityRole="button" style={s.signInButton}><Text style={s.signInText}>ACCOUNT</Text></Pressable>:
      <><Pressable onPress={()=>setAuthScreen("signin")} accessibilityRole="button" style={s.signInButton}><Text style={s.signInText}>SIGN IN</Text></Pressable>
       <Pressable onPress={()=>setAuthScreen("register")} accessibilityRole="button" style={s.joinButton}><Text style={s.joinButtonText}>JOIN</Text></Pressable></>}
    </View>
   </View>
   {activeTab==="Profile"&&session?
    <ProfileScreen userId={session.user.id} email={session.user.email??undefined} onSignOut={signOut}/>:
    activeTab==="Explore"?
     <ExploreScreen userId={session?.user.id??null} onSignIn={()=>setAuthScreen("signin")} onJoin={()=>setAuthScreen("register")}/>:
    activeTab==="Home"||activeTab==="Create"?
     <FeedScreen
      userId={session?.user.id??null}
      mode={activeTab==="Create"?"create":"feed"}
      onSignIn={()=>setAuthScreen("signin")}
      onJoin={()=>setAuthScreen("register")}
      onOpenComposer={()=>setActiveTab("Create")}
      onPostCreated={()=>setActiveTab("Home")}
     />:
     <View style={s.placeholderPanel}>
      <Text style={s.eyebrow}>CREOVA FOUNDATION</Text>
      <Text style={s.heading}>Inbox</Text>
      <Text style={s.placeholderText}>Your conversations and messages are next in the integrated Stage 1 build.</Text>
      <Text style={s.placeholderMeta}>BUILDING · Stage 1 feature parity</Text>
     </View>}
   <View style={s.tabBar}>{TABS.map(tab=>{
    const selected=activeTab===tab;
    return <Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected}} onPress={()=>setActiveTab(tab)} style={s.tab}>
     <Text style={[s.tabGlyph,selected&&s.selectedText]}>{tab==="Home"?"⌂":tab==="Explore"?"⌕":tab==="Create"?"+":tab==="Inbox"?"▤":"◉"}</Text>
     <Text style={[s.tabLabel,selected&&s.selectedText]}>{tab}</Text>
    </Pressable>;
   })}</View>
  </View>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#070A12"},app:{flex:1,backgroundColor:"#070A12"},
 header:{minHeight:68,paddingHorizontal:16,paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#1A2235",flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 wordmark:{color:"#F4F7FF",fontSize:22,fontWeight:"900",letterSpacing:3},tagline:{color:"#8295BA",fontSize:9,fontWeight:"700",letterSpacing:2,marginTop:3},
 headerActions:{flexDirection:"row",alignItems:"center",gap:8},signInButton:{borderRadius:18,paddingHorizontal:13,paddingVertical:10,borderWidth:1,borderColor:"#315B89"},
 signInText:{color:"#B6D6FF",fontSize:10,fontWeight:"900",letterSpacing:1},joinButton:{borderRadius:18,paddingHorizontal:16,paddingVertical:10,backgroundColor:"#244F91",borderWidth:1,borderColor:"#477CC9"},
 joinButtonText:{color:"#FFFFFF",fontSize:10,fontWeight:"900",letterSpacing:1.3},eyebrow:{color:"#6E9FFF",fontSize:10,fontWeight:"800",letterSpacing:2.5,marginTop:6},
 heading:{color:"#F4F7FF",fontSize:28,fontWeight:"800",marginTop:4,marginBottom:16},
 tabBar:{minHeight:66,borderTopWidth:1,borderTopColor:"#1A2235",backgroundColor:"#090E19",flexDirection:"row",justifyContent:"space-around",alignItems:"center",paddingHorizontal:5,paddingBottom:4},
 tab:{flex:1,alignItems:"center",justifyContent:"center",gap:3,minHeight:54},tabGlyph:{color:"#71809A",fontSize:21,fontWeight:"700"},
 tabLabel:{color:"#71809A",fontSize:9,fontWeight:"700"},selectedText:{color:"#8CB8FF"},
 profilePanel:{flex:1,padding:22},profileEmail:{color:"#F4F7FF",fontSize:16,fontWeight:"700",marginTop:8},
 profileMeta:{color:"#A4B2CA",fontSize:12,marginTop:8},signOutButton:{marginTop:24,alignSelf:"flex-start",paddingVertical:13,paddingHorizontal:18,borderWidth:1,borderColor:"#477CC9",borderRadius:12},
 signOutText:{color:"#B6D6FF",fontSize:11,fontWeight:"900",letterSpacing:1},placeholderPanel:{flex:1,padding:20,justifyContent:"center"},
 placeholderText:{color:"#B6C4DE",fontSize:14,lineHeight:22,maxWidth:340},placeholderMeta:{color:"#7EA9F5",fontSize:10,fontWeight:"800",letterSpacing:1.2,marginTop:16}
});
