-- AUTHENTICATION & MULTI-FAMILY MIGRATION
-- Author: Senior Full Stack Engineer
-- Date: 2026-01-01

BEGIN;

-- 1. Create Families Table
CREATE TABLE IF NOT EXISTS public.families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed an initial family for Fabio & Giulia
INSERT INTO public.families (name, join_code)
VALUES ('Famiglia Fabio & Giulia', 'FAM-BGH-777')
ON CONFLICT (join_code) DO NOTHING;

-- 2. Add family_id to all tables
DO $$ 
DECLARE 
    first_family_id UUID;
BEGIN
    SELECT id INTO first_family_id FROM public.families LIMIT 1;

    -- Update family_members
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'family_id') THEN
        ALTER TABLE public.family_members ADD COLUMN family_id UUID REFERENCES public.families(id);
        UPDATE public.family_members SET family_id = first_family_id;
        ALTER TABLE public.family_members ALTER COLUMN family_id SET NOT NULL;
    END IF;

    -- Update categories
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'family_id') THEN
        ALTER TABLE public.categories ADD COLUMN family_id UUID REFERENCES public.families(id);
        UPDATE public.categories SET family_id = first_family_id;
        -- Note: We might want shared categories later, but for now every family has their own.
    END IF;

    -- Update transactions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'family_id') THEN
        ALTER TABLE public.transactions ADD COLUMN family_id UUID REFERENCES public.families(id);
        UPDATE public.transactions SET family_id = first_family_id;
    END IF;

    -- Update fixed_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_items' AND column_name = 'family_id') THEN
        ALTER TABLE public.fixed_items ADD COLUMN family_id UUID REFERENCES public.families(id);
        UPDATE public.fixed_items SET family_id = first_family_id;
    END IF;

    -- Update accounts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'family_id') THEN
        ALTER TABLE public.accounts ADD COLUMN family_id UUID REFERENCES public.families(id);
        UPDATE public.accounts SET family_id = first_family_id;
    END IF;
END $$;

-- 3. Link family_members to auth.users
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'user_id') THEN
        ALTER TABLE public.family_members ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 4. Update RLS Policies
-- We need to ensure users can only see data from their family_id.
-- First, drop old policies
DROP POLICY IF EXISTS "Public full access on family_members" ON public.family_members;
DROP POLICY IF EXISTS "Public full access on categories" ON public.categories;
DROP POLICY IF EXISTS "Public full access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Public full access on fixed_items" ON public.fixed_items;
DROP POLICY IF EXISTS "Public full access on accounts" ON public.accounts;

-- Helper function to get the current user's family_id
CREATE OR REPLACE FUNCTION public.get_user_family_id()
RETURNS UUID AS $$
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- New Secure Policies
CREATE POLICY "Users can see and edit their own family data" ON public.family_members
    FOR ALL USING (family_id = public.get_user_family_id() OR user_id = auth.uid());

CREATE POLICY "Users can see and edit their own family data" ON public.categories
    FOR ALL USING (family_id = public.get_user_family_id());

CREATE POLICY "Users can see and edit their own family data" ON public.transactions
    FOR ALL USING (family_id = public.get_user_family_id());

CREATE POLICY "Users can see and edit their own family data" ON public.fixed_items
    FOR ALL USING (family_id = public.get_user_family_id());

CREATE POLICY "Users can see and edit their own family data" ON public.accounts
    FOR ALL USING (family_id = public.get_user_family_id());

COMMIT;
