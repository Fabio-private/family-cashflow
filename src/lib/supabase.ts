import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '');
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '');

// Validation helper
const isValidUrl = (url: string | undefined): url is string => {
  try {
    return !!url && (url.startsWith('http://') || url.startsWith('https://'));
  } catch {
    return false;
  }
};

if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase configuration is invalid or missing.\n' +
    'Check your .env.local (or Vercel Settings) for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
} else {
  console.log('✅ Supabase environment variables detected.');
}

// We use a fallback that looks like a URL to prevent the 'Invalid supabaseUrl' crash during build/init
export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl : 'https://your-project.supabase.co',
  supabaseAnonKey || 'your-anon-key'
);
