import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { requireSupabase } from '../../lib/supabase';

const EMAIL_CONFIRMATION_REDIRECT = 'creova://auth/callback';

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error');

  function showMessage(value: string, kind: 'error' | 'success' = 'error') {
    setMessage(value);
    setMessageKind(kind);
  }

  async function submit() {
    Keyboard.dismiss();
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedEmail)) {
      showMessage('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      showMessage('Your password must be at least 8 characters.');
      return;
    }
    if (mode === 'signup' && !displayName.trim()) {
      showMessage('Enter your display name.');
      return;
    }
    if (mode === 'signup' && !/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      showMessage('Choose a username with 3–24 letters, numbers, or underscores.');
      return;
    }

    setBusy(true);
    try {
      const client = requireSupabase();
      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: EMAIL_CONFIRMATION_REDIRECT,
            data: {
              display_name: displayName.trim(),
              username: normalizedUsername,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          showMessage('Your CREOVA account is ready. Welcome in!', 'success');
        } else {
          setAwaitingEmailConfirmation(true);
          showMessage('We sent a confirmation link to your email. Open it on this device to verify your address and finish signing in.', 'success');
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      const lowerMessage = rawMessage.toLowerCase();
      if (lowerMessage.includes('username') && (lowerMessage.includes('already') || lowerMessage.includes('duplicate') || lowerMessage.includes('unique'))) {
        showMessage('That username is already taken. Choose another one.');
      } else if (lowerMessage.includes('already registered') || lowerMessage.includes('already been registered')) {
        showMessage('An account with this email already exists. Switch to Sign in.');
      } else if (lowerMessage.includes('invalid login credentials')) {
        showMessage('Email or password is incorrect. If you just registered, confirm your email first.');
      } else {
        showMessage(rawMessage || 'We could not complete that request. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    Keyboard.dismiss();
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedEmail)) {
      showMessage('Enter your email address above first.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await requireSupabase().auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: { emailRedirectTo: EMAIL_CONFIRMATION_REDIRECT },
      });
      if (error) throw error;
      showMessage('A new confirmation email has been requested. Open its link on this device. Check your spam folder too.', 'success');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      showMessage(rawMessage || 'We could not resend the confirmation email. Please wait a little and try again.');
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    Keyboard.dismiss();
    setAwaitingEmailConfirmation(false);
    setMode(current => current === 'signin' ? 'signup' : 'signin');
    setMessage('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardPage}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <Image
            source={require('../../../assets/brand/creova-icon-safe-area-preview.png')}
            style={styles.brandMark}
            resizeMode="contain"
            accessibilityLabel="CREOVA app icon"
          />
          <Text style={styles.brand}>CREOVA</Text>
          <Text style={styles.tagline}>CREATE. CONNECT. EVOLVE.</Text>
          <Text style={styles.title}>{awaitingEmailConfirmation ? 'Confirm your email' : mode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
          <Text style={styles.subtitle}>
            {awaitingEmailConfirmation ? 'Open the confirmation link sent to your inbox' : mode === 'signin' ? 'Sign in to continue your world' : 'Join CREOVA and start evolving'}
          </Text>
          <View style={styles.card}>
            {!awaitingEmailConfirmation && mode === 'signup' && <>
              <Text style={styles.label}>DISPLAY NAME</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#71819C"
                style={styles.input}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <Text style={styles.label}>USERNAME</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="your_username"
                placeholderTextColor="#71819C"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </>}
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#71819C"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              editable={!awaitingEmailConfirmation && !busy}
              returnKeyType="next"
            />
            {!awaitingEmailConfirmation && <>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor="#71819C"
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                returnKeyType="done"
                onSubmitEditing={submit}
              />
            </>}
            {!!message && (
              <Text accessibilityRole="alert" style={[styles.message, messageKind === 'success' && styles.successMessage]}>
                {message}
              </Text>
            )}
            {!awaitingEmailConfirmation && <TouchableOpacity
              disabled={busy}
              onPress={submit}
              style={[styles.primary, busy && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={mode === 'signin' ? 'Sign in' : 'Create account'}
            >
              {busy
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.primaryText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
            </TouchableOpacity>}
            {awaitingEmailConfirmation && <>
              <TouchableOpacity disabled={busy} onPress={resendConfirmation} style={[styles.primary, busy && styles.disabled]} accessibilityRole="button">
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Resend confirmation email</Text>}
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} onPress={() => { setAwaitingEmailConfirmation(false); setMessage(''); }} style={styles.switch} accessibilityRole="button">
                <Text style={styles.switchText}>Back to account details</Text>
              </TouchableOpacity>
            </>}
            {!awaitingEmailConfirmation && <TouchableOpacity disabled={busy} onPress={switchMode} style={styles.switch} accessibilityRole="button">
              <Text style={styles.switchText}>
                {mode === 'signin' ? 'New to CREOVA?  Create an account' : 'Already have an account?  Sign in'}
              </Text>
            </TouchableOpacity>}
          </View>
          <Text style={styles.footnote}>Account details are handled by CREOVA's configured authentication service.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardPage: { flex: 1, backgroundColor: '#090D18' },
  scrollContent: { flexGrow: 1 },
  page: { flexGrow: 1, backgroundColor: '#090D18', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 30, alignItems: 'center' },
  brandMark: { width: 100, height: 100 },
  brand: { color: '#F5F7FF', fontSize: 20, fontWeight: '900', letterSpacing: 3, marginTop: 10 },
  tagline: { color: '#9AAAC4', fontSize: 9, letterSpacing: 1.6, marginTop: 4 },
  title: { color: '#F5F7FF', fontSize: 30, fontWeight: '900', marginTop: 28, textAlign: 'center' },
  subtitle: { color: '#9AAAC4', fontSize: 13, marginTop: 7, marginBottom: 20, textAlign: 'center' },
  card: { width: '100%', maxWidth: 430, backgroundColor: '#111A2B', borderColor: '#263650', borderWidth: 1, borderRadius: 22, padding: 20, gap: 10 },
  label: { color: '#AFC5E8', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 4 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#263650', backgroundColor: '#0B1322', color: '#F5F7FF', paddingHorizontal: 14, fontSize: 14 },
  message: { color: '#F4C77B', fontSize: 12, lineHeight: 18 },
  successMessage: { color: '#8EDDB5' },
  primary: { minHeight: 49, borderRadius: 13, backgroundColor: '#3985FF', alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  disabled: { opacity: 0.65 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  switch: { paddingVertical: 10, alignItems: 'center' },
  switchText: { color: '#AFC5E8', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  footnote: { color: '#71819C', fontSize: 10, textAlign: 'center', marginTop: 18, maxWidth: 330, lineHeight: 16 },
});
