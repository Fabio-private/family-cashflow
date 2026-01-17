-- Add 'Abbigliamento' category for all families that don't have it
INSERT INTO categories (name, type, family_id)
SELECT DISTINCT 'Abbigliamento', 'expense', family_id 
FROM family_members
WHERE family_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM categories c 
    WHERE c.family_id = family_members.family_id AND c.name = 'Abbigliamento'
);
