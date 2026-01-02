-- REMOVE AUTHENTICATION AND ENABLE PUBLIC ACCESS
-- Run this in your Supabase SQL Editor

-- 1. Drop all existing RLS policies that require authentication
DROP POLICY IF EXISTS "Users can see and edit their own family data" ON public.family_members;
DROP POLICY IF EXISTS "Users can see and edit their own family data" ON public.categories;
DROP POLICY IF EXISTS "Users can see and edit their own family data" ON public.transactions;
DROP POLICY IF EXISTS "Users can see and edit their own family data" ON public.fixed_items;
DROP POLICY IF EXISTS "Users can see and edit their own family data" ON public.accounts;
DROP POLICY IF EXISTS "Anyone authenticated can see family members" ON public.family_members;

-- 2. Create new "Public Access" policies for all tables
-- This allows reading and writing without being logged in.
CREATE POLICY "Public Access" ON public.family_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON public.fixed_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON public.families FOR ALL USING (true) WITH CHECK (true);

-- 3. Note: We keep RLS enabled but with a "Public Access" policy for better compatibility with Supabase client.
