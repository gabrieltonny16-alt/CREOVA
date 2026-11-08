import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { AuthScreen } from './AuthScreen';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

async function handleAuthCallback(url: string) {
  if (!supabase || !url.startsWith('creova://auth/callback')) return;

  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams([query, hash].filter(Boolean).join('&'));

  const errorDescription = params.get('error_description') || params.get('error');
  if (errorDescription) {
    console.warn('CREOVA email verification failed:', errorDescription);
    return;
  }

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (error) throw error;
    return;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        setSession(data.session);
        setLoading(false);
      }
    }).catch(() => {
      if (alive) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    const processUrl = (url: string | null) => {
      if (url) {
        void handleAuthCallback(url).catch(error => {
          console.warn('CREOVA auth callback could not be processed:', error);
        });
      }
    };
    void Linking.getInitialURL().then(processUrl).catch(error => {
      console.warn('CREOVA could not read the initial auth link:', error);
    });
    const linkSubscription = Linking.addEventListener('url', event => processUrl(event.url));

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#8DB8FF" /><Text style={styles.loadingText}>Preparing your CREOVA session…</Text></View>;
  }

  if (!isSupabaseConfigured) {
    return <View style={styles.setup}><Text style={styles.brand}>CREOVA</Text><Text style={styles.title}>Development backend needed</Text><Text style={styles.copy}>The account screens are ready, but authentication is not connected yet. Configure the CREOVA-DEV URL and publishable key in the local environment. Do not use the old production database credentials.</Text></View>;
  }

  return session ? <>{children}</> : <AuthScreen />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#090D18', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#9AAAC4', fontSize: 12 },
  setup: { flex: 1, backgroundColor: '#090D18', justifyContent: 'center', alignItems: 'center', padding: 28 },
  brand: { color: '#F5F7FF', fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  title: { color: '#F5F7FF', fontSize: 22, fontWeight: '800', marginTop: 25, textAlign: 'center' },
  copy: { color: '#9AAAC4', fontSize: 13, lineHeight: 21, textAlign: 'center', maxWidth: 430, marginTop: 12 }
});
