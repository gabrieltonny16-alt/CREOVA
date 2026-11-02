import { createClient } from '@supabase/supabase-js';

// These values are intentionally public: Supabase publishable keys are designed
// for browser use. Row Level Security is the security boundary, never this key.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://fiejlbvkjcdjqkcdamrf.supabase.co';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_ia5LhPL6jq_2qUltqk116A_dG3bxYkW';

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabase = isSupabaseConfigured ? createClient(url, publishableKey) : null;
