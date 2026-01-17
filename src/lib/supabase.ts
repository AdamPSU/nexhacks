import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if we have valid-looking credentials to prevent initialization errors during compilation
const isConfigured = 
  supabaseUrl && 
  supabaseUrl.startsWith('http') && 
  supabaseAnonKey && 
  supabaseAnonKey !== 'placeholder-key';

if (!isConfigured && typeof window !== 'undefined') {
  console.warn(
    '⚠️ Supabase is not configured. The UI will load, but database features (saving/loading) will not work.'
  );
}

// Only initialize if configured, otherwise export null to avoid crashing Next.js during build/dev
export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : (null as any);








