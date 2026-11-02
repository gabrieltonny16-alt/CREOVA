import { FormEvent, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';

type Anchor = {
  id: string;
  title: string;
  description: string;
  skill: string;
  status: string;
  created_at: string;
  creator_id: string;
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skill, setSkill] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    async function loadAnchors() {
      const { data, error } = await supabase!
        .from('anchors')
        .select('id,title,description,skill,status,created_at,creator_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30);
      if (!cancelled) {
        if (error) setNotice(error.message);
        else setAnchors((data ?? []) as Anchor[]);
      }
    }
    loadAnchors();
    return () => { cancelled = true; };
  }, [session]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setNotice('');
    try {
      if (authMode === 'signup') {
        if (username.trim().length < 3) throw new Error('Username must be at least 3 characters.');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: username.trim(), display_name: displayName.trim() || username.trim() } },
        });
        if (error) throw error;
        setNotice(data.session
          ? 'Your CREOVA account is ready.'
          : 'Account created. Check your email to confirm your address, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setNotice('Welcome back. You are signed in.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function createAnchor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session?.user) return;
    setBusy(true);
    setNotice('');
    try {
      const { error } = await supabase.from('anchors').insert({
        creator_id: session.user.id,
        title: title.trim(),
        description: description.trim(),
        skill: skill.trim(),
      });
      if (error) throw error;
      setTitle('');
      setDescription('');
      setSkill('');
      setNotice('Your Anchor is live. Let the work begin.');
      const { data } = await supabase.from('anchors')
        .select('id,title,description,skill,status,created_at,creator_id')
        .eq('status', 'active').order('created_at', { ascending: false }).limit(30);
      setAnchors((data ?? []) as Anchor[]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not publish your Anchor.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    setNotice(error ? error.message : 'You have signed out.');
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="shell">
        <nav className="topbar"><a className="wordmark" href="/"><span className="mark">C</span><span>CREOVA</span></a><span className="nav-note">THE ACTIVE SKILL NETWORK</span></nav>
        <section className="workspace">
          <p className="section-kicker">ONE CONNECTION LEFT</p>
          <h1>Connect the<br /><em>CREOVA engine.</em></h1>
          <p className="intro">The Supabase project is ready. Add its URL and publishable key as the two Vite environment variables to enable accounts and live Anchors.</p>
          <div className="setup-card"><strong>VITE_SUPABASE_URL</strong><code>https://fiejlbvkjcdjqkcdamrf.supabase.co</code><strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong><code>Use the project publishable key from Supabase.</code></div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <nav className="topbar">
        <a className="wordmark" href="#"><span className="mark">C</span><span>CREOVA</span></a>
        <span className="nav-note">THE ACTIVE SKILL NETWORK</span>
        {session ? <button className="text-button" onClick={signOut}>Sign out ↗</button> : <a className="sign-in" href="#account">Account ↗</a>}
      </nav>

      <section className="workspace">
        <div className="eyebrow"><span className="pulse" /> ACTION · EXECUTION · EVOLUTION · PROOF</div>
        <h1>Make something<br /><em>move forward.</em></h1>
        <p className="intro">Start with an Anchor. Put a skill, challenge, or idea into motion. Others can build on the work and grow its execution tree.</p>

        {notice && <p className="notice" role="status">{notice}</p>}

        {!session ? (
          <section className="account-card" id="account">
            <div className="section-kicker">JOIN THE NETWORK</div>
            <div className="mode-switch">
              <button className={authMode === 'signup' ? 'mode active' : 'mode'} onClick={() => setAuthMode('signup')}>Create account</button>
              <button className={authMode === 'signin' ? 'mode active' : 'mode'} onClick={() => setAuthMode('signin')}>Sign in</button>
            </div>
            <form onSubmit={handleAuth} className="form-stack">
              {authMode === 'signup' && <>
                <label>Display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="How people know you" maxLength={60} /></label>
                <label>Username<input value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" minLength={3} maxLength={24} required /></label>
              </>}
              <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
              <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required /></label>
              <button className="primary-cta" type="submit" disabled={busy}>{busy ? 'Please wait…' : authMode === 'signup' ? 'Create your account →' : 'Sign in →'}</button>
            </form>
          </section>
        ) : (
          <section className="account-card">
            <div className="section-kicker">YOUR NEXT EXECUTION</div>
            <h2>Welcome into the network.</h2>
            <p className="muted">{session.user.email}</p>
            <form onSubmit={createAnchor} className="form-stack">
              <label>Anchor title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you want to move forward?" minLength={4} maxLength={100} required /></label>
              <label>Skill or category<input value={skill} onChange={e => setSkill(e.target.value)} placeholder="e.g. Design, Coding, Cooking" minLength={2} maxLength={50} required /></label>
              <label>Describe the action<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Explain the challenge, idea, or skill and what execution looks like." minLength={10} maxLength={2000} rows={4} required /></label>
              <button className="primary-cta" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Launch Anchor →'}</button>
            </form>
          </section>
        )}
      </section>

      <section className="feed">
        <div className="section-kicker">LIVE ANCHORS</div>
        <h2>Ideas in <em>motion.</em></h2>
        {anchors.length === 0 ? <p className="muted">No active Anchors yet. Be the first to start one.</p> : (
          <div className="anchor-grid">
            {anchors.map(anchor => (
              <article className="anchor-card" key={anchor.id}>
                <span className="anchor-skill">{anchor.skill}</span>
                <h3>{anchor.title}</h3>
                <p>{anchor.description}</p>
                <div className="anchor-meta">BY CREATOR · {new Date(anchor.created_at).toLocaleDateString()}</div>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer><span>CREOVA © 2026</span><span>CREATE. EXECUTE. EVOLVE. PROVE.</span></footer>
    </main>
  );
}

export default App;
