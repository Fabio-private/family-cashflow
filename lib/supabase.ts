import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are missing. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local');
}

export const supabase = createClient(
  supabaseUrl || 'https://fkuiigbqqnuglhojlkrv.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrdWlpZ2JxcW51Z2xob2psa3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MjQ0NDYsImV4cCI6MjA4MjUwMDQ0Nn0.ocWfgmT17P_pifPNhqqCC4QoQdrcut8txWCQPo-24z0'
);
