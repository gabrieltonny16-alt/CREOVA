import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { requireSupabase } from '../../lib/supabase';

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    setMessage('');
    if (!email.trim() || password.length < 8) {
      setMessage('Enter a valid email and a password of at least 8 characters.');
      return;
    }
    if (mode === 'signup' && (!displayName.trim() || !/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase()))) {
      setMessage('Add your display name and a username (3–24 letters, numbers, or underscores).');
      return;
    }
    setBusy(true);
    try {
      const client = requireSupabase();
      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { display_name: displayName.trim(), username: username.trim().toLowerCase() } },
        });
        if (error) throw error;
        setMessage(data.session ? 'Your CREOVA account is ready.' : 'Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.brandMark}><Text style={styles.brandLetter}>C</Text></View>
      <Text style={styles.brand}>CREOVA</Text>
      <Text style={styles.tagline}>CREATE. CONNECT. EVOLVE.</Text>
      <Text style={styles.title}>{mode === 'signin' ? 'Welcome back.' : 'Find your place.'}</Text>
      <Text style={styles.subtitle}>{mode === 'signin' ? 'Sign in to continue your world.' : 'Create your identity and start evolving.'}</Text>
      <View style={styles.card}>
        {mode === 'signup' && <>
          <Text style={styles.label}>DISPLAY NAME</Text>
          <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor="#71819C" style={styles.input} autoCapitalize="words" />
          <Text style={styles.label}>USERNAME</Text>
          <TextInput value={username} onChangeText={setUsername} placeholder="your_username" placeholderTextColor="#71819C" style={styles.input} autoCapitalize="none" autoCorrect={false} />
        </>}
        <Text style={styles.label}>EMAIL</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#71819C" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Text style={styles.label}>PASSWORD</Text>
        <TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#71819C" style={styles.input} secureTextEntry autoCapitalize="none" />
        {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
        <TouchableOpacity disabled={busy} onPress={submit} style={[styles.primary, busy && styles.disabled]} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }} style={styles.switch}>
          <Text style={styles.switchText}>{mode === 'signin' ? 'New to CREOVA?  Create an account' : 'Already have an account?  Sign in'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footnote}>Account details are handled by CREOVA's configured authentication service.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#090D18', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 36, alignItems: 'center' },
  brandMark: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#172D55', borderWidth: 1, borderColor: '#4268A4', alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: '#A7C6FF', fontSize: 31, fontWeight: '900' },
  brand: { color: '#F5F7FF', fontSize: 20, fontWeight: '900', letterSpacing: 3, marginTop: 10 },
  tagline: { color: '#9AAAC4', fontSize: 9, letterSpacing: 1.6, marginTop: 4 },
  title: { color: '#F5F7FF', fontSize: 30, fontWeight: '900', marginTop: 32 },
  subtitle: { color: '#9AAAC4', fontSize: 13, marginTop: 7, marginBottom: 22, textAlign: 'center' },
  card: { width: '100%', maxWidth: 430, backgroundColor: '#111A2B', borderColor: '#263650', borderWidth: 1, borderRadius: 22, padding: 20, gap: 10 },
  label: { color: '#AFC5E8', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 4 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#263650', backgroundColor: '#0B1322', color: '#F5F7FF', paddingHorizontal: 14, fontSize: 14 },
  message: { color: '#F4C77B', fontSize: 12, lineHeight: 18 },
  primary: { minHeight: 49, borderRadius: 13, backgroundColor: '#3985FF', alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  disabled: { opacity: 0.65 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  switch: { paddingVertical: 10, alignItems: 'center' },
  switchText: { color: '#AFC5E8', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  footnote: { color: '#71819C', fontSize: 10, textAlign: 'center', marginTop: 18, maxWidth: 330, lineHeight: 16 }
});
