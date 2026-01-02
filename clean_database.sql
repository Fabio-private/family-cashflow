-- ==========================================
-- SCRIPT DI PULIZIA DATABASE (RESET TRANSAZIONI)
-- ==========================================

-- 1. Rimuove tutte le transazioni esistenti
TRUNCATE TABLE transactions CASCADE;

-- 2. Rimuove tutti i modelli di spesa ricorrente (Fixed Items)
TRUNCATE TABLE fixed_items CASCADE;

-- 3. Opzionale: Se vuoi resettare anche i nomi degli account o altri dati, 
-- puoi aggiungere i comandi qui. Al momento preserviamo i Membri, le Categorie e i Conti.

-- NOTA: TRUNCATE TABLE è più veloce di DELETE e resetta anche i contatori ID.
-- CASCADE assicura che vengano rimosse eventuali dipendenze se presenti.

-- Dopo aver eseguito questo script, l'applicazione sarà "vuota" 
-- e pronta per l'inserimento dei dati reali.
