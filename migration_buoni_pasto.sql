-- MIGRATION: Add Buoni Pasto Account
-- This account is owned by NULL to treat it like a joint account (shared family resource)
-- This ensures it's automatically excluded from individual rebalancing.

INSERT INTO public.accounts (name, owner_id)
VALUES ('Buoni Pasto Fabio', NULL)
ON CONFLICT (name) DO NOTHING;
