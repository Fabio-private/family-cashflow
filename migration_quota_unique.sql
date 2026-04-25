-- BUG-13 — Prevenire doppio insert della quota mensile (600€) per stesso payer/mese
--
-- Strategia: unique partial index su (payer_id, family_id, mese, description) limitato
-- alle righe income con description che inizia per "Quota Mensile Fideuram". Includere
-- la `description` nella chiave permette quote "extra"/manuali con descrizione diversa
-- nello stesso mese (es. "Quota Mensile Fideuram (Automatico)" + "...extra fabio") senza
-- bloccarle, mentre impedisce due insert identici dell'automatica (caso doppio click).
--
-- Nota: il DB non ha colonna `month_extracted`. `to_char(date,'YYYY-MM')` NON è IMMUTABLE
-- per il tipo `date` (Postgres rifiuta in indice). Uso invece aritmetica su EXTRACT, che è
-- IMMUTABLE: `EXTRACT(YEAR FROM date)*100 + EXTRACT(MONTH FROM date)` produce un intero
-- tipo 202604, equivalente come chiave di unicità.
--
-- Query di check duplicati (deve ritornare 0 righe prima della creazione):
--
--   SELECT payer_id, family_id,
--          (EXTRACT(YEAR FROM date)*100 + EXTRACT(MONTH FROM date))::int AS m,
--          description, count(*)
--   FROM public.transactions
--   WHERE type = 'income' AND description ILIKE 'Quota Mensile Fideuram%'
--   GROUP BY 1,2,3,4 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_quota_mensile_per_payer_month
ON public.transactions (
    payer_id,
    family_id,
    ((EXTRACT(YEAR FROM date)*100 + EXTRACT(MONTH FROM date))),
    description
)
WHERE type = 'income'
  AND description ILIKE 'Quota Mensile Fideuram%';
