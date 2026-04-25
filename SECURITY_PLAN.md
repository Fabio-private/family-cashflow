# SECURITY_PLAN — Family Cashflow

**Data piano:** 2026-04-25
**Scope:** ripristino RLS basato su `family_id` + igiene chiavi.
**Stato attuale (D5):** RLS disabilitato (file `remove_auth.sql` applicato). Chiunque abbia la `anon key` legge/scrive l'intero DB. La sicurezza pratica oggi è "obscurity della anon key".
**Nota:** questo è un PIANO. Nessun codice/policy/DB modificato. Esecuzione richiede approvazione esplicita per ciascuno step.

---

## Step 0 — INCIDENTE: rotazione chiavi (PRIORITÀ MASSIMA)

**Cosa è successo:** la `service_role` key del progetto Supabase (`xykfvmeecakyfvpsrgqq`) è stata esposta in chat il **2026-04-25**. La `service_role` bypassa RLS ed è il segreto più sensibile del progetto.

**Azioni:**
1. Supabase Dashboard → Project Settings → API → **Reset `service_role` key**.
2. Ruotare anche la `anon` key per igiene (anche se meno critica). Aggiornare `.env.local` e variabili Vercel.
3. Rebuild + redeploy dell'app.
4. Verifica: `git log -p` non deve contenere chiavi committate; controllare `.env*` in `.gitignore`.
5. Se possibile, abilitare audit log Supabase per detection futura.

**Rischi se non eseguito:** chiunque ne sia in possesso può cancellare/leggere tutto il DB di famiglia, fare read di righe finanziarie, manomettere transazioni — RLS o no, la `service_role` la bypassa.

**Prerequisiti:** nessuno. Va fatto subito, indipendentemente dal resto del piano.

---

## Stato attuale dell'auth (analisi)

### `AuthContext.tsx` (oggi)
- Solo `localStorage.getItem("family_member")`.
- **Nessuna chiamata `supabase.auth.*`** — niente login, niente JWT, niente sessione Supabase.
- "Login" = pagina `select-profile` che salva l'oggetto `FamilyMember` in localStorage.
- Conseguenza: lato client, le query Supabase usano la `anon` key senza alcun token utente. RLS basata su `auth.uid()` non potrebbe funzionare.

### `family_members.user_id` (live)
| Membro | role | user_id |
|---|---|---|
| Fabio | parent | `6dcb3621-...` ✅ |
| Giulia | parent | `9fdee805-...` ✅ |
| Federico | child | `NULL` |
| Ludovica | child | `NULL` |
| Dante | pet | `NULL` |

I 2 adulti sono **già mappati a `auth.users`**. I figli/pet no, ma per loro non serve login.

### Implicazione
RLS su `family_id` è realizzabile, ma richiede un **vero login Supabase** (email/password o magic link) per Fabio e Giulia, in modo che `auth.uid()` sia popolato. Lo schema sul DB c'è già, manca il flusso client.

---

## Step 1 — Introduzione vero login Supabase Auth

**Obiettivo:** il client invia un JWT valido a Supabase. `auth.uid()` lato DB diventa popolato.

**Azioni:**
1. Decidere flusso: magic-link via email è più semplice (no password mgmt) e va bene per uso familiare.
2. In `select-profile/page.tsx`: dopo la scelta del membro, se è un parent, richiedere login Supabase prima di proseguire.
3. In `AuthContext.tsx`:
   - Aggiungere `supabase.auth.onAuthStateChange` per tracciare la sessione.
   - Caricare `member` da `family_members WHERE user_id = auth.user.id` invece che da localStorage (per i parent). Per child/pet (selezione "vista figlio") tenere il fallback localStorage.
   - `signOut` chiama anche `supabase.auth.signOut()`.
4. Per Fabio e Giulia: è già pronto il mapping `family_members.user_id`. Si fa un primo login con le email associate ai loro `user_id` esistenti.

**Rischi:**
- **Lock-out:** se il login fallisce o l'email non arriva, l'utente non può usare l'app. Mitigazione: tenere il flusso "select-profile senza login" come fallback dietro feature-flag finché il nuovo flusso non è stabile.
- **UX:** i figli/pet non hanno user_id. Servirà una semantica "logged-in-as <Fabio>, viewing <Federico>" — la sessione resta del genitore.

**Prerequisiti:** Step 0.

---

## Step 2 — Definire policy RLS (in staging, non in prod)

**Obiettivo:** scrivere e testare le policy senza romperle in prod.

### Tabelle in scope

| Tabella | Read | Insert/Update/Delete | Note |
|---|---|---|---|
| `families` | row WHERE id = (SELECT family_id FROM family_members WHERE user_id = auth.uid()) | come read | una sola famiglia per ora |
| `family_members` | row WHERE family_id = (subquery sopra) | come read | self-edit del proprio user_id solo |
| `accounts` | row WHERE family_id = (subquery) | come read | |
| `categories` | row WHERE family_id = (subquery) | come read | |
| `transactions` | row WHERE family_id = (subquery) | come read | tabella critica — più traffico |
| `fixed_items` | row WHERE family_id = (subquery) | come read | |
| `monthly_summary` (VIEW) | filtra automaticamente via le RLS sottostanti | n/a | verificare che non bypassi RLS |

### Pattern policy (esempio per `transactions`)

```sql
-- Solo bozza concettuale, da rifinire in staging
CREATE POLICY "tx_family_isolation" ON transactions
FOR ALL
USING (family_id IN (
  SELECT family_id FROM family_members WHERE user_id = auth.uid()
))
WITH CHECK (family_id IN (
  SELECT family_id FROM family_members WHERE user_id = auth.uid()
));
```

**Punti d'attenzione:**
- La subquery `SELECT family_id FROM family_members WHERE user_id = auth.uid()` va wrappata in una **funzione `STABLE` SECURITY DEFINER** per evitare ricorsione su RLS di `family_members` stessa.
- `monthly_summary` è una VIEW: se è creata `SECURITY DEFINER` o `SECURITY INVOKER` cambia tutto. Va verificato.
- Insert: `WITH CHECK` deve impedire scritture in altre famiglie. Test esplicito.
- I bambini/pet non hanno user_id: spese a loro nome (`beneficiary_id = child`) sono comunque accessibili al genitore perché `family_id` matcha.

**Prerequisiti:** Step 1 funzionante.

---

## Step 3 — Test in staging

**Obiettivo:** validare che (a) policy non rompano l'app, (b) blocchino davvero accessi cross-family.

**Azioni:**
1. Creare progetto Supabase staging (clone di prod o seed manuale di una 2ª famiglia di test).
2. Login con utente famiglia A → verifica vede solo righe famiglia A.
3. Login con utente famiglia B → verifica vede solo righe famiglia B.
4. Tentativo di insert con `family_id` di un'altra famiglia → deve fallire.
5. Verifica funzionalità app end-to-end: dashboard, riconciliazione, modali, calendar, analytics.
6. Verifica monthly_summary VIEW.
7. Stress test: la subquery RLS su transactions può rallentare. Misurare con EXPLAIN.

**Rischi:**
- Performance: ogni query su `transactions` invoca la subquery RLS. Mitigazione: indice su `family_members(user_id)`.
- Edge case: la pagina `share/` (link pubblico?) potrebbe richiedere accesso anonimo. Da verificare.

**Prerequisiti:** Step 2.

---

## Step 4 — Rollout in produzione

**Azioni:**
1. Backup completo del DB prod (Supabase Dashboard → Database → Backups).
2. Applicare policy in una transazione SQL singola; tenere uno script di rollback (`DROP POLICY ...; ALTER TABLE ... DISABLE ROW LEVEL SECURITY;`).
3. Deploy del codice nuovo (Step 1) **prima** delle policy: la app deve già passare un JWT valido prima che le policy entrino in vigore, altrimenti l'app si rompe.
4. Smoke test post-deploy con Fabio e Giulia.
5. Se tutto OK, considerare l'eliminazione del file `remove_auth.sql` dal repo (non più rappresentativo dello stato).

**Rischi:**
- **Downtime / lock-out famiglia:** se le policy sono troppo strette, Fabio/Giulia non vedono le proprie righe. Mitigazione: rollback script pronto.
- Se `service_role` viene riusata in qualche edge function/script, quella ignora RLS — verificare che non ci siano script lato server con la chiave vecchia.

**Prerequisiti:** Step 3 verde.

---

## Step 5 — Hardening complementare (opzionale)

- **Audit log applicativo:** trigger su `transactions` per registrare chi ha inserito/modificato cosa (campo `created_by`, `updated_by`).
- **Eliminazione `remove_auth.sql`** dal repo dopo Step 4 verde.
- **CSP / headers** sul deploy Vercel.
- **Rate limiting** su Supabase (Pro plan feature).
- **Email notifications** sui login da nuovo device (Supabase Auth feature).
- **Backup off-site** periodico (oggi backup vivono solo in Supabase).

---

## Riassunto rischi globali

| Rischio | Severità | Mitigazione |
|---|---|---|
| service_role esposta usata da malintenzionato | 🔴 ALTA | Step 0 immediato |
| Policy troppo strette → lock-out famiglia | 🟠 MEDIA | Test staging + rollback script |
| Performance degradation su transactions | 🟠 MEDIA | Indice su family_members(user_id), funzione STABLE |
| `monthly_summary` VIEW bypassa RLS | 🟠 MEDIA | Verificare definizione VIEW in Step 2 |
| Pagina `share/` richiede accesso anon | 🟡 BASSA | Identificare e usare link signed o RPC dedicato |
| User dimentica password / non riceve magic link | 🟡 BASSA | Magic link via email + supporto manuale (2 utenti totali) |

---

## Ordine di esecuzione consigliato

1. **Step 0** (rotazione chiavi) — **immediato, indipendente.**
2. Step 1 (vero login) — settimana 1.
3. Step 2 + 3 (policy + staging) — settimana 2.
4. Step 4 (rollout) — settimana 3, in finestra di basso traffico.
5. Step 5 — opzionale, post-stabilizzazione.
