-- Creazione categorie Giroconto con nomi univoci per evitare conflitti di constraint
-- Usiamo nomi distinti per superare il vincolo UNIQUE(name) se presente
INSERT INTO public.categories (name, type)
SELECT 'Giroconto (Uscita)', 'expense'
WHERE NOT EXISTS (
    SELECT 1 FROM public.categories WHERE name = 'Giroconto (Uscita)'
);

INSERT INTO public.categories (name, type)
SELECT 'Giroconto (Entrata)', 'income'
WHERE NOT EXISTS (
    SELECT 1 FROM public.categories WHERE name = 'Giroconto (Entrata)'
);
