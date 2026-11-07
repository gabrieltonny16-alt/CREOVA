import React, { useEffect, useState } from 'react';
import { AuthGate } from './src/features/auth/AuthGate';
import { getMyProfile, searchProfiles, followProfile } from './src/features/profile/profileService';
import type { CreovaProfile } from './src/features/profile/profileService';
import { supabase } from './src/lib/supabase';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

type Tab = 'Home' | 'Discover' | 'Create' | 'Inbox' | 'Profile';

const COLORS = {
  background: '#090D18',
  surface: '#111A2B',
  surfaceRaised: '#17243A',
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

function Brand() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>C</Text></View>
      <View>
        <Text style={styles.brandName}>CREOVA</Text>
        <Text style={styles.brandTagline}>CREATE. CONNECT. EVOLVE.</Text>
      </View>
    </View>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✦</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

function HomeScreen() {
  return (
    <View style={styles.screenContent}>
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.eyebrow}>YOUR WORLD</Text>
          <Text style={styles.heading}>Home</Text>
        </View>
        <View style={styles.livePill}><View style={styles.statusDot} /><Text style={styles.liveText}>NEW PLATFORM</Text></View>
      </View>
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeGlow} />
        <Text style={styles.welcomeEyebrow}>A NEW WAY TO BE SOCIAL</Text>
        <Text style={styles.welcomeTitle}>Your world.{ '\n' }Your evolution.</Text>
        <Text style={styles.welcomeCopy}>Connect with people, discover ideas, share what you create, and show how it evolves.</Text>
        <View style={styles.pillarRow}>
          <View style={styles.pillar}><Text style={styles.pillarNumber}>01</Text><Text style={styles.pillarLabel}>CONNECT</Text></View>
          <View style={styles.pillarDivider} />
          <View style={styles.pillar}><Text style={styles.pillarNumber}>02</Text><Text style={styles.pillarLabel}>CREATE</Text></View>
          <View style={styles.pillarDivider} />
          <View style={styles.pillar}><Text style={styles.pillarNumber}>03</Text><Text style={styles.pillarLabel}>EVOLVE</Text></View>
        </View>
      </View>
      <View style={styles.feedHeading}>
        <Text style={styles.subheading}>Your feed</Text>
        <Text style={styles.mutedSmall}>PERSONALIZED FOR YOU</Text>
      </View>
      <EmptyState title="Your feed starts here" description="Posts from people you follow will appear here. The live social feed will be connected after accounts, publishing, and the follow system are implemented." />
    </View>
  );
}

function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchProfiles>>>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function search() {
    setBusy(true); setMessage('');
    try { setResults(await searchProfiles(query)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Search failed.'); }
    finally { setBusy(false); }
  }
  async function follow(id: string) {
    try {
      const result = await followProfile(id);
      setResults(items => items.map(item => item.id === id ? { ...item, followState: result } as typeof item : item));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Follow action failed.'); }
  }
  return <View style={styles.screenContent}>
    <Text style={styles.eyebrow}>FIND YOUR PEOPLE</Text>
    <Text style={styles.heading}>Explore</Text>
    <View style={styles.searchRow}>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search usernames" placeholderTextColor="#71819C" style={styles.searchInput} autoCapitalize="none" autoCorrect={false} onSubmitEditing={search} />
      <TouchableOpacity onPress={search} disabled={busy} style={styles.searchButton}><Text style={styles.searchButtonText}>{busy ? '…' : 'Search'}</Text></TouchableOpacity>
    </View>
    {!!message && <Text style={styles.notice}>{message}</Text>}
    {results.map(item => <View key={item.id} style={styles.resultRow}>
      <View style={styles.resultAvatar}><Text style={styles.resultAvatarText}>{(item.display_name || item.username).slice(0,1).toUpperCase()}</Text></View>
      <View style={styles.resultInfo}><Text style={styles.resultName}>{item.display_name}</Text><Text style={styles.resultHandle}>@{item.username}{item.is_private ? ' · Private' : ''}</Text></View>
      <TouchableOpacity onPress={() => follow(item.id)} style={styles.followButton}><Text style={styles.followButtonText}>{(item as typeof item & {followState?: string}).followState === 'requested' ? 'Requested' : (item as typeof item & {followState?: string}).followState === 'following' ? 'Following' : 'Follow'}</Text></TouchableOpacity>
    </View>)}
    {query.trim().length < 2 && <EmptyState title="Discover something new" description="Search for CREOVA members by username. More discovery feeds and trending topics will follow." />}
    {query.trim().length >= 2 && !busy && results.length === 0 && <EmptyState title="No members found" description="Try another username." />}
  </View>;
}

function CreateScreen() {
  return <View style={styles.screenContent}>
    <Text style={styles.eyebrow}>MAKE SOMETHING THAT MOVES</Text>
    <Text style={styles.heading}>Create</Text>
    <View style={styles.createOption}><Text style={styles.optionSymbol}>▧</Text><View style={styles.optionText}><Text style={styles.optionTitle}>Post</Text><Text style={styles.optionDescription}>Share a photo, carousel, or video.</Text></View><Text style={styles.optionArrow}>›</Text></View>
    <View style={styles.createOption}><Text style={styles.optionSymbol}>▶</Text><View style={styles.optionText}><Text style={styles.optionTitle}>Short video</Text><Text style={styles.optionDescription}>Create a vertical video for discovery.</Text></View><Text style={styles.optionArrow}>›</Text></View>
    <View style={styles.createOption}><Text style={styles.optionSymbol}>⌘</Text><View style={styles.optionText}><Text style={styles.optionTitle}>Anchor</Text><Text style={styles.optionDescription}>Start an idea that others can build on.</Text></View><Text style={styles.optionArrow}>›</Text></View>
    <Text style={styles.notice}>Publishing is not connected yet. These creation flows will be enabled when secure media storage and publishing services are ready.</Text>
  </View>;
}

function InboxScreen() {
  return <View style={styles.screenContent}>
    <Text style={styles.eyebrow}>STAY IN THE LOOP</Text>
    <Text style={styles.heading}>Inbox</Text>
    <EmptyState title="Your conversations will appear here" description="Private and group messaging will be connected after the conversation service, privacy rules, and real-time delivery are implemented." />
  </View>;
}

function ProfileScreen() {
  const [profile, setProfile] = useState<CreovaProfile | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getMyProfile().then(value => { if (active) setProfile(value); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load your profile.'); });
    return () => { active = false; };
  }, []);
  async function signOut() { await supabase?.auth.signOut(); }
  return <View style={styles.screenContent}>
    <Text style={styles.eyebrow}>YOUR CREOVA IDENTITY</Text>
    <Text style={styles.heading}>Profile</Text>
    {profile ? <View style={styles.profileCard}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{(profile.display_name || profile.username).slice(0,1).toUpperCase()}</Text></View>
      <Text style={styles.profileName}>{profile.display_name}</Text>
      <Text style={styles.profileHandle}>@{profile.username}</Text>
      <Text style={styles.profileCopy}>{profile.bio || 'Add a bio to tell your story.'}</Text>
      <Text style={styles.profilePrivacy}>{profile.is_private ? 'PRIVATE ACCOUNT' : 'PUBLIC ACCOUNT'}</Text>
      <TouchableOpacity onPress={signOut} style={styles.signOutButton}><Text style={styles.signOutText}>Sign out</Text></TouchableOpacity>
    </View> : <EmptyState title={error || 'Loading your profile…'} description={error ? 'Check your connection and try again.' : 'Your account profile is being loaded from CREOVA.'} />}
    <EmptyState title="Your evolution starts here" description="Your posts, Anchors, Iterations, skills, and proof of execution will come together on your profile." />
  </View>;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  const renderScreen = () => {
    switch (activeTab) {
      case 'Discover': return <DiscoverScreen />;
      case 'Create': return <CreateScreen />;
      case 'Inbox': return <InboxScreen />;
      case 'Profile': return <ProfileScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.app}>
        <View style={[styles.topBar, isWide && styles.topBarWide]}>
          <Brand />
          {isWide && <Text style={styles.topBarNote}>THE SOCIAL NETWORK BUILT FOR EVOLUTION</Text>}
          <View style={styles.topBarAction}><Text style={styles.topBarActionText}>✧</Text></View>
        </View>
        <View style={[styles.body, isWide && styles.bodyWide]}>
          {isWide && <View style={styles.sideNav}>
            {TABS.map(tab => <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.sideNavItem, activeTab === tab.key && styles.sideNavItemActive]}>
              <Text style={[styles.sideNavSymbol, activeTab === tab.key && styles.activeText]}>{tab.symbol}</Text>
              <Text style={[styles.sideNavLabel, activeTab === tab.key && styles.activeText]}>{tab.label}</Text>
            </TouchableOpacity>)}
          </View>}
          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.mainScrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.contentMax, isWide && styles.contentMaxWide]}>{renderScreen()}</View>
          </ScrollView>
        </View>
        {!isWide && <View style={styles.bottomNav}>
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
  topBar: { height: 72, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarWide: { paddingHorizontal: 36 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: '#355B9C', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#8DB8FF', fontSize: 24, fontWeight: '800' },
  brandName: { color: COLORS.text, fontSize: 17, fontWeight: '900', letterSpacing: 2.6 },
  brandTagline: { color: COLORS.muted, fontSize: 8, letterSpacing: 1.4, marginTop: 3 },
  topBarNote: { color: COLORS.muted, fontSize: 10, letterSpacing: 1.8 },
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
  mainScrollContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36 },
  contentMax: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  contentMaxWide: { maxWidth: 760 },
  screenContent: { gap: 18 },
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
  emptyCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 23, alignItems: 'center', gap: 10 },
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
  profileCard: { alignItems: 'center', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 9 },
  avatar: { width: 76, height: 76, borderRadius: 28, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: '#4268A4', alignItems: 'center', justifyContent: 'center' },
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
  resultAvatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  resultAvatarText: { color: '#A7C6FF', fontSize: 17, fontWeight: '900' },
  resultInfo: { flex: 1, gap: 4 },
  resultName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  resultHandle: { color: COLORS.muted, fontSize: 10 },
  followButton: { backgroundColor: COLORS.accentSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  followButtonText: { color: '#A7C6FF', fontSize: 10, fontWeight: '800' },
  profileHandle: { color: '#A7C6FF', fontSize: 12, fontWeight: '700' },
  profilePrivacy: { color: COLORS.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: '800' },
  signOutButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  signOutText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  bottomNavLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '600' }
});


export default function App() {
  return <AuthGate><MainApp /></AuthGate>;
}
