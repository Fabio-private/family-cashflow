-- MIGRATION: Update Schema for Family Roles and Accounts

-- 1. Create Roles Enum
DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('parent', 'child', 'pet');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update family_members
ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS role member_role DEFAULT 'child';

-- Set Roles
UPDATE public.family_members SET role = 'parent' WHERE name IN ('Fabio', 'Giulia');
UPDATE public.family_members SET role = 'pet' WHERE name = 'Dante';
UPDATE public.family_members SET role = 'child' WHERE name IN ('Ludovica', 'Federico');

-- 3. Create Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    owner_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL, -- NULL for joint
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Accounts
INSERT INTO public.accounts (name, owner_id)
SELECT 'C/C Fabio', id FROM public.family_members WHERE name = 'Fabio'
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.accounts (name, owner_id)
SELECT 'C/C Giulia', id FROM public.family_members WHERE name = 'Giulia'
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.accounts (name, owner_id) -- Joint
VALUES ('Fideuram Cointestato', NULL)
ON CONFLICT (name) DO NOTHING;

-- 4. Update Transactions
-- Since we are in development, we can rename columns. In production we would migrate data differently.
-- If transactions exist, we map member_id to payer_id
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='member_id') THEN
        ALTER TABLE public.transactions RENAME COLUMN member_id TO payer_id;
    END IF;
END $$;

-- Add beneficiary_id and account_id
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS beneficiary_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Default beneficiary to the family (NULL) or to the payer if it's personal? 
-- For now, keep NULL (Family).

-- 5. Update Monthly Summary View
CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT 
    TO_CHAR(date, 'YYYY-MM') AS month,
    fm.name AS member_name,
    t.type,
    SUM(t.amount) AS total_amount
FROM 
    public.transactions t
JOIN 
    public.family_members fm ON t.payer_id = fm.id
GROUP BY 
    1, 2, 3
ORDER BY 
    month DESC, member_name;
-- 6. Update Fixed Items (Recurring)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fixed_items' AND column_name='member_id') THEN
        ALTER TABLE public.fixed_items RENAME COLUMN member_id TO payer_id;
    END IF;
END $$;

ALTER TABLE public.fixed_items ADD COLUMN IF NOT EXISTS beneficiary_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL;
ALTER TABLE public.fixed_items ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.fixed_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.fixed_items ADD COLUMN IF NOT EXISTS next_generation_date DATE DEFAULT (CURRENT_DATE + INTERVAL '1 month');
