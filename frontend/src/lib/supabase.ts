import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// Capture this before the client consumes (and clears) the URL hash.
export const isPasswordRecoveryLink =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

// Supabase client is only initialised when credentials are provided.
// In local auth mode these env vars are empty and supabase will be null.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
