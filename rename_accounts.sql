-- Ridenominazione conti come richiesto dall'utente
UPDATE public.accounts SET name = 'Fabio' WHERE name = 'C/C Fabio';
UPDATE public.accounts SET name = 'Giulia' WHERE name = 'C/C Giulia';
UPDATE public.accounts SET name = 'Fideuram condiviso' WHERE name = 'Fideuram Cointestato' OR name = 'Fideuram Cointestato';
UPDATE public.accounts SET name = 'Buoni pasto Fabio' WHERE name = 'Buoni Pasto Fabio';
