-- FAMILY EXPENSE TRACKER - DATABASE SCHEMA
-- Author: Senior Backend Engineer
-- Date: 2025-12-31

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('expense', 'income');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE frequency_type AS ENUM ('monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES
-- Family Members Table
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    type transaction_type NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    type transaction_type NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Fixed Items (Recurring) Table
CREATE TABLE IF NOT EXISTS public.fixed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    type transaction_type NOT NULL,
    member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
    frequency frequency_type NOT NULL DEFAULT 'monthly',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SEED DATA
-- Insert Family Members
INSERT INTO public.family_members (name)
VALUES ('Ludovica'), ('Federico'), ('Fabio'), ('Giulia'), ('Dante')
ON CONFLICT (name) DO NOTHING;

-- Insert Categories
INSERT INTO public.categories (name, type)
VALUES 
    ('Alimentari', 'expense'),
    ('Salute', 'expense'),
    ('Istruzione', 'expense'),
    ('Svago', 'expense'),
    ('Casa', 'expense'),
    ('Trasporti', 'expense'),
    ('Stipendio', 'income'),
    ('Regalo', 'income')
ON CONFLICT (name) DO NOTHING;

-- 4. VIEWS
-- Monthly Summary View
CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT 
    TO_CHAR(date, 'YYYY-MM') AS month,
    fm.name AS member_name,
    t.type,
    SUM(t.amount) AS total_amount
FROM 
    public.transactions t
JOIN 
    public.family_members fm ON t.member_id = fm.id
GROUP BY 
    1, 2, 3
ORDER BY 
    month DESC, member_name;

-- 5. ROW LEVEL SECURITY (RLS)
-- Enable RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_items ENABLE ROW LEVEL SECURITY;

-- Basic Policies: Full Public Access (Write/Read)
-- Family Members
CREATE POLICY "Public full access on family_members" ON public.family_members
    FOR ALL USING (true) WITH CHECK (true);

-- Categories
CREATE POLICY "Public full access on categories" ON public.categories
    FOR ALL USING (true) WITH CHECK (true);

-- Transactions
CREATE POLICY "Public full access on transactions" ON public.transactions
    FOR ALL USING (true) WITH CHECK (true);

-- Fixed Items
CREATE POLICY "Public full access on fixed_items" ON public.fixed_items
    FOR ALL USING (true) WITH CHECK (true);
