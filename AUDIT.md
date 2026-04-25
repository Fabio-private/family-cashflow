# AUDIT — Family Cashflow

**Data audit:** 2026-04-25
**Scope:** checkup completo del progetto, con focus sulla logica di riconciliazione Fabio↔Giulia
**Metodo:** 3 agenti paralleli — mappatura architetturale, audit logica codice, verifica live Supabase

---

## TL;DR

L'app è ben strutturata (Next.js 16 + React 19 + Supabase). La logica di rebalancing è **concettualmente corretta** nelle sue formule chiave, ma ha **3 bug di severità ALTA** che producono calcoli sbagliati o effetti collaterali non desiderati nel mese corrente, più ~12 problemi di severità medio/bassa che riguardano edge case, hardcoding, drift di nomi e doppia identificazione del conto cointestato.

In più, il database live ha due residui da pulire: 9 transazioni "Pareggio Spese" con `account_id NULL` (artefatti da test) e 54 transazioni senza `category_id`.

**Priorità immediate:** fix bug #7 (Settlement raddoppia il debito), #1 (filtro family inquinato), #11 (buoni pasto inflazionano credito di Fabio).

---

## 1. Architettura del progetto

### Stack
- **Frontend:** Next.js 16.1.1 (App Router) + React 19.2.3 + TypeScript 5
- **DB / Backend:** Supabase (PostgreSQL) via `@supabase/supabase-js` 2.89.0
- **UI:** TailwindCSS 4 + Lucide icons + Recharts 3.6
- **Parsing estratti conto:** XLSX 0.18.5 + PapaParse 5.5.3
- **Date:** date-fns 4.1
- **Deploy:** Vercel

### Struttura
```
src/
  app/                  → Next.js App Router (routes)
    page.tsx, layout.tsx
    analytics/, calendar/, member/[id]/, reconciliation/,
    select-profile/, share/, transactions/
  components/
    Dashboard.tsx       → ★ logica rebalancing (918 righe)
    AddTransactionModal.tsx, BottomNav, Sidebar, Header, ...
  context/AuthContext.tsx  → membro selezionato (localStorage)
  lib/
    supabase.ts         → client + validazione env
    types.ts            → interfacce TS
    bankStatementParser.ts, transactionMatcher.ts
```

### Modello dati (Supabase)

| Tabella | Colonne chiave | Note |
|---|---|---|
| `families` | id, name, join_code | 1 famiglia attiva ("Fabio & Giulia") |
| `family_members` | id, name, role (parent/child/pet), user_id, family_id | 5 membri: Fabio, Giulia (parent), Ludovica, Federico (child), Dante (pet) |
| `accounts` | id, name, **owner_id (NULL = joint)**, family_id | 4 conti: C/C Fabio, C/C Giulia, Fideuram condiviso, Buoni pasto Fabio |
| `categories` | id, name, type (expense/income), family_id | 15 categorie. Distinzione income fisso vs extra è basata SOLO sul nome |
| `transactions` | id, amount, type, date, payer_id, **beneficiary_id (NULL = famiglia)**, account_id, category_id | ~346 record (live). Range 2026-01-02 → 2026-04-28 |
| `fixed_items` | … + frequency, active, next_generation_date | 6 attivi (Iliad, Spotify, Rate, ecc.) |
| `monthly_summary` (VIEW) | month, member_name, type, total_amount | Aggregato esposto via REST |

**Convenzioni semantiche cruciali:**
- `account.owner_id IS NULL` ⇒ conto cointestato
- `transaction.beneficiary_id IS NULL` ⇒ spesa "famiglia"
- `beneficiary_id = childId` ⇒ spesa per figlio/pet
- `beneficiary_id = partnerId` ⇒ Fabio paga per Giulia (o viceversa)
- "Income extra" (regalo/bonus) identificato **solo** da `categories.name.toLowerCase().includes('regalo'|'bonus')` — niente flag/enum a DB.

### Punti chiave della business logic (riferimenti file)

| Funzionalità | File | Righe |
|---|---|---|
| Filtro spese famiglia | [Dashboard.tsx:58-79](src/components/Dashboard.tsx#L58-L79) | — |
| Rebalancing netBalance | [Dashboard.tsx:407-460](src/components/Dashboard.tsx#L407-L460) | — |
| Stato contributi quota | [Dashboard.tsx:462-487](src/components/Dashboard.tsx#L462-L487) | — |
| Pareggio spese | [Dashboard.tsx:489-515](src/components/Dashboard.tsx#L489-L515) | — |
| Registra quota 600€ | [Dashboard.tsx:517-575](src/components/Dashboard.tsx#L517-L575) | — |
| Riconciliazione bancaria | [reconciliation/page.tsx](src/app/reconciliation/page.tsx) + [transactionMatcher.ts](src/lib/transactionMatcher.ts) | — |

---

## 2. Stato Supabase live

| Check | Risultato |
|---|---|
| Connessione REST | ✅ OK (~150-300 ms) |
| Schema atteso | ✅ Tutte le tabelle presenti |
| Conti previsti | ✅ Fabio, Giulia, Fideuram condiviso, Buoni pasto Fabio |
| Famiglia | ✅ 1 famiglia attiva, 5 membri |
| Auth | ⚠️ RLS disabilitato (Public Access). Auth user_id mappati ma non usati come filtro |
| Range date | ✅ Dentro 2026 |
| Coppie giroconto | ✅ 10 entrate / 10 uscite bilanciate |
| Importi anomali (=0 o <0) | ✅ Nessuno |

### Anomalie sui dati

| # | Severità | Problema | Conta |
|---|---|---|---|
| D1 | MEDIA | `transactions.account_id IS NULL` su 9 righe "Pareggio Spese - marzo 2026" con importi geometrici (81.95, 40.97, 20.49, …) — chiari artefatti da test/loop | 9 |
| D2 | MEDIA | `transactions.category_id IS NULL` su ~54 righe — impatta grafici per categoria | ~54 |
| D3 | BASSA | Categorie income ridondanti: `Regalo` e `Bonus/Regali`. Anche categoria expense `Regali` separata | 3 |
| D4 | BASSA | View `monthly_summary` mostra Dante (pet) con income 571.30€ a gen 2026 e Federico (child) con expense 98.26€. Da verificare che NON entrino nei calcoli rebalancing | 2 |
| D5 | INFO | RLS in modalità "Public Access" (`remove_auth.sql`): chiunque ha la anon key legge/scrive tutto. Per produzione condivisa va rivisto | — |

---

## 3. Audit logica riconciliazione — bug trovati

### Bug ALTA severità

#### 🔴 BUG-7 — `handleSettlement` raddoppia il debito anziché azzerarlo
**File:** [Dashboard.tsx:489-515](src/components/Dashboard.tsx#L489-L515)

Il pulsante "Pareggia ora" inserisce una expense da debitore→creditore, ma:
1. **Manca `account_id`** nell'insert → la riga finisce con `accounts = NULL`
2. **Categoria `Altro`** (non dedicata) → non viene esclusa dai filtri
3. **Data = `now`**, ignora `selectedMonth` → se pareggi marzo a fine aprile, la riga finisce ad aprile
4. La riga ha `payer != beneficiary` su due adulti → finisce in `fabioPaidForGiulia`/`giuliaPaidForFabio` (riga 442-443) **reinflazionando il debito di metà valore nello stesso mese**

**Evidenza nel DB live:** le 9 righe "Pareggio Spese - marzo 2026" con importi geometrici 81.95 → 40.97 → 20.49 → … sono esattamente la sequenza di un loop di pareggi che dimezzano il debito ad ogni click. Il bug è già stato osservato in produzione.

#### 🔴 BUG-1 — `familyTransactions` include prestiti incrociati come spese di gruppo
**File:** [Dashboard.tsx:58-79](src/components/Dashboard.tsx#L58-L79)

Il commento riga 56 dichiara una regola, il codice ne implementa un'altra. La condizione `t.beneficiary_id !== t.payer_id` (riga 75) include anche i prestiti Fabio→Giulia, che sono OK per il rebalancing ma vengono poi consumati anche da `categoryData` e `dynamicBudget`, **inflazionando i totali "famiglia"** mostrati in dashboard.

#### 🔴 BUG-11 — Buoni pasto trattati come "personale" nel rebalancing
**File:** [Dashboard.tsx:60-64](src/components/Dashboard.tsx#L60-L64) vs [Dashboard.tsx:416-420](src/components/Dashboard.tsx#L416-L420)

In `familyTransactions` "Buoni Pasto Fabio" è considerato joint/meal-voucher (escluso). In `rebalanceData` invece è considerato **personale di Fabio** (perché `owner_id != null`). Conseguenza: una spesa famiglia pagata coi buoni pasto viene contata come "Fabio ha tirato fuori soldi suoi", **falsamente accreditando Fabio**.

**Esempio:** Fabio spende 200€ in spesa famiglia coi buoni pasto → il rebalancing dice che Giulia gli deve 100€, ma Fabio non ha tirato fuori nulla dal proprio patrimonio.

### Bug MEDIA severità

#### 🟠 BUG-3 — Whitelist contributi è una blacklist (regalo/bonus)
**File:** [Dashboard.tsx:425-435](src/components/Dashboard.tsx#L425-L435)

`currentMonthContributions` accetta **qualsiasi income** sul cointestato salvo categoria contiene "regalo"/"bonus". Quindi se uno stipendio o un rimborso INPS finisce sul Fideuram, viene contato come contributo personale.

**Esempio:** Giulia riceve lo stipendio direttamente sul cointestato → il rebalancing la fa risultare creditrice di metà stipendio.

#### 🟠 BUG-4 — Match `includes('bonus')` è troppo stretto
**File:** [Dashboard.tsx:429](src/components/Dashboard.tsx#L429)

Non matcha "Assegno Unico" (citato esplicitamente nell'UI a riga 253), "INPS", "Cashback", "Rimborso". Queste entrate finiscono nel rebalancing come contributi.

Inoltre c'è inconsistenza con `dynamicBudget` (riga 343-348) che guarda **anche la descrizione**, mentre `rebalanceData` guarda solo la categoria.

#### 🟠 BUG-2 — `contributionStatus` accetta qualsiasi income ≥600€
**File:** [Dashboard.tsx:472-487](src/components/Dashboard.tsx#L472-L487)

Il pallino "verde quota versata" si accende per qualsiasi income ≥600€ sul Fideuram con quel `payer_id`. Un bonus INPS di 1.200€ accreditato sul Fideuram con payer Fabio → il pulsante quota di Fabio diventa verde anche se non ha mai girocontato 600€ dal suo personale.

#### 🟠 BUG-5 — TZ inconsistency tra `getMonth()` e `format(yyyy-MM)`
**File:** [Dashboard.tsx:418-419, 431-432](src/components/Dashboard.tsx#L418-L432) vs [Dashboard.tsx:209-210, 285-291](src/components/Dashboard.tsx#L209-L210)

Alcuni filtri usano `new Date(t.date).getMonth()` (UTC se la stringa non ha `T`), altri usano `format(d, "yyyy-MM")` (locale). Per fusi orari non-Europe i bordi mese (1° o ultimo del mese) cadono in mesi diversi tra le due strategie. Bug latente per ora ma scattante se l'app viene usata in viaggio.

#### 🟠 BUG-8 — Settlement e Quota usano `new Date()` ignorando `selectedMonth`
**File:** [Dashboard.tsx:493](src/components/Dashboard.tsx#L493), [Dashboard.tsx:538](src/components/Dashboard.tsx#L538)

Se navighi a un mese passato e clicchi "Pareggia ora" o "Quota", la transazione viene inserita con la data odierna, non nel mese visualizzato.

#### 🟠 BUG-9 — Identificazione cointestato per stringhe magic incoerenti
Stringhe Fideuram in 6+ punti del codice: alcuni cercano "Fideuram Cointestato", altri "Fideuram condiviso", altri usano `owner_id IS NULL`. Il DB live ha `Fideuram condiviso` (rinominato da `rename_accounts.sql`). Rinominare di nuovo rompe metà dei calcoli silenziosamente.

#### 🟠 BUG-10 — `fabio` / `giulia` hardcoded per nome
**File:** [Dashboard.tsx:408-409, 469-470, 700, 732](src/components/Dashboard.tsx#L408-L409)

Il rebalancing è vincolato a 2 membri identificati per nome lowercased. Cambiare nome ("Fabio M.") rompe il calcolo. La tabella ha già `role='parent'` ma il codice non lo usa.

#### 🟠 BUG-6 — Terzo adulto non gestito
**File:** [Dashboard.tsx:437-438](src/components/Dashboard.tsx#L437-L438)

Se beneficiary è un adulto ≠ Fabio/Giulia (es. nonno), la spesa scompare dal rebalancing. Edge case non realistico oggi, ma da documentare.

### Bug BASSA severità

| # | File | Sintesi |
|---|---|---|
| BUG-12 | [Dashboard.tsx:526](src/components/Dashboard.tsx#L526) | Lookup giroconto case-sensitive (`includes('Giroconto')`) mentre altrove è case-insensitive |
| BUG-13 | [Dashboard.tsx:472, 565](src/components/Dashboard.tsx#L472) | Doppio click sul pulsante quota → doppio insert di 600€ |
| BUG-14 | [reconciliation/page.tsx:41-43](src/app/reconciliation/page.tsx#L41-L43) | `useState(() => fetchAccounts())` invece di `useEffect` — anti-pattern, fragile in StrictMode |
| BUG-15 | [Dashboard.tsx:95](src/components/Dashboard.tsx#L95) | `family_id.is.null` legacy contamina i calcoli con righe pre-migrazione di altre famiglie |

### Aree corrette (note positive)

1. ✅ **Identificazione cointestato via `owner_id IS NULL`** in `rebalanceData` — robusta e indipendente dai nomi
2. ✅ **Esclusione regalo/bonus dai contributi** (commit 62a1c98) — concettualmente giusta
3. ✅ **Formula `(fabioTotal − giuliaTotal) / 2`** (commit 7776b4c) — algebricamente corretta
4. ✅ **Filtro `!isFromJointAccount` su currentMonthExpenses** evita doppio conteggio
5. ✅ **Esclusione "giroconto" da `familyTransactions`**
6. ✅ **Coppie giroconto bilanciate nel DB live** (10/10)
7. ✅ **Riconciliazione bancaria robusta** (parser XLSX + fuzzy matching)

---

## 4. Piano di risoluzione

### Fase 1 — Hotfix critici (priorità massima, da fare in ordine)

| # | Bug | Fix proposta | File | Rischio |
|---|---|---|---|---|
| F1.1 | BUG-7 | (a) Creare categoria dedicata "Pareggio" e seedarla via migration; (b) escluderla da `currentMonthExpenses`/`familyTransactions`/`fabioPaidForGiulia`; (c) salvare `account_id` esplicito (uscita conto debitore + entrata conto creditore in due righe, oppure account_id del conto del debitore); (d) usare `endOfMonth(selectedMonth)` come data | Dashboard.tsx:489-515 + nuova migration | Medio — tocca insert critica |
| F1.2 | BUG-11 | In `rebalanceData`: trattare `accounts.name.toLowerCase().includes('buoni pasto')` come "joint funzionale" (escluderlo da `currentMonthExpenses`) | Dashboard.tsx:416-420 | Basso |
| F1.3 | BUG-1 | Riscrivere `familyTransactions` separando: `groupExpenses` (beneficiary null o figlio/pet) per UI/grafici; `crossLoans` (Fabio↔Giulia) solo per rebalancing. Aggiornare `categoryData`, `dynamicBudget`, `effectiveTotalExpenses` per usare il filtro corretto | Dashboard.tsx:58-79 + chiamanti | Alto — tocca molti consumatori |

### Fase 2 — Sanare il DB live

| # | Azione | Note |
|---|---|---|
| F2.1 | Eliminare le 9 righe "Pareggio Spese - marzo 2026" con `account_id IS NULL` | Confermare con utente prima. Sono artefatti del bug F1.1 |
| F2.2 | Assegnare categoria alle ~54 righe con `category_id NULL` | Può essere fatto a mano o con uno script di triage |
| F2.3 | Decidere se consolidare `Regalo` ↔ `Bonus/Regali` o documentarne la differenza | Solo dopo F3.1 |

### Fase 3 — Fix media severità (qualità/robustezza)

| # | Bug | Fix |
|---|---|---|
| F3.1 | BUG-3, BUG-4, BUG-2 | Estrarre helper `isExternalIncome(t)` (o flag `is_contribution` su `categories`). Whitelist invertita: contano solo categorie tipo "Giroconto (Entrata)"/"Quota"/"Apporto". Allargare regalo/bonus a "assegno unico", "inps", "rimborso", "cashback" |
| F3.2 | BUG-5 | Usare ovunque `format(d, "yyyy-MM") === format(selectedMonth, "yyyy-MM")` |
| F3.3 | BUG-8 | Usare `endOfMonth(selectedMonth)` come `date` in settlement e quota |
| F3.4 | BUG-9 | Usare `account.owner_id === null` come UNICA fonte per "joint", eliminare whitelist per nome |
| F3.5 | BUG-10 | Sostituire hardcoding `fabio`/`giulia` con `members.filter(m => m.role === 'parent')` ordinati per id |
| F3.6 | BUG-12 | `c.name.toLowerCase().includes('giroconto')` ovunque |
| F3.7 | BUG-13 | Disabilitare ottimisticamente al click + unique constraint DB su (`payer_id`, `month_extracted`, descrizione "Quota") |

### Fase 4 — Igiene codice (bassa priorità)

| # | Bug | Fix |
|---|---|---|
| F4.1 | BUG-14 | Sostituire `useState(initFn)` con `useEffect` in [reconciliation/page.tsx:41](src/app/reconciliation/page.tsx#L41) |
| F4.2 | BUG-15 | Rimuovere il fallback `family_id.is.null` da fetchData (riga 95) dopo aver verificato che non ci siano più righe legacy |
| F4.3 | BUG-6 | Documentare assunzione "2 adulti" o aggiungere ramo per terzo adulto |
| F4.4 | D5 | Considerare ripristino RLS basato su `family_id` ora che gli `user_id` sono mappati (al momento sicurezza = "ho la anon key") |

### Suggerimento operativo

I fix di **Fase 1** richiedono un'unica sessione di lavoro coordinata (toccano la stessa funzione). I fix di **Fase 3** sono indipendenti e si prestano a sessioni separate (chat pulite) per risparmiare contesto: ogni bug è isolabile.

**Suggerita sequenza di nuove sessioni Claude:**
1. **Sessione "hotfix-F1"** — risolve BUG-7, BUG-11, BUG-1 (Fase 1) + ripulisce DB (Fase 2)
2. **Sessione "income-detection"** — risolve cluster BUG-3/4/2 (Fase 3.1) — refactoring helper centralizzato
3. **Sessione "consistency"** — risolve BUG-5/8/9/10/12/13 (Fase 3.2-3.7) — molti piccoli fix coerenti
4. **Sessione "hardening"** — Fase 4 (igiene + RLS)

Ognuna parte da contesto pulito leggendo questo `AUDIT.md` come briefing.

---

## 5. Allegati

### Mappa file critici

- [src/components/Dashboard.tsx](src/components/Dashboard.tsx) — concentra ~80% della logica analizzata
- [src/lib/types.ts](src/lib/types.ts) — modello dati TS
- [src/app/reconciliation/page.tsx](src/app/reconciliation/page.tsx) — riconciliazione bancaria
- [migration_giroconto.sql](migration_giroconto.sql) — categorie giroconto
- [migration_family_dynamics.sql](migration_family_dynamics.sql) — schema accounts/beneficiary
- [remove_auth.sql](remove_auth.sql) — disattivazione RLS

### Commit recenti rilevanti
- `62a1c98` — fix: exclude regalo/bonus income from rebalancing contributions
- `7776b4c` — fix: correct rebalancing calculation to include joint account contributions
- `cf6f670` — feat: filtri/totali transactions table

### Score complessivo
- **Architettura:** 8/10 (chiara, ben separata)
- **Modello dati:** 7/10 (semantica solida ma manca tipizzazione enum per income kind)
- **Logica business:** 5/10 (formula corretta, ma molti bug pratici nel mese corrente)
- **Sicurezza:** 4/10 (RLS disabilitato, anon key con accesso totale)
- **Salute DB live:** 7/10 (dati coerenti, qualche residuo da pulire)

---

## 6. Changelog sessioni

### Sessione hotfix-F1 — 2026-04-25 ✅ COMPLETATA

**Codice (Dashboard.tsx):**
- ❌ **Rimossa** la memo `familyTransactions` (era la fonte di BUG-1).
- ✅ **Aggiunte** 3 memo separate, da usare al suo posto:
  - `groupExpenses` — spese che gravano sul budget famiglia (per UI/grafici/totali). Esclude prestiti adulto↔adulto e righe "pareggio spese".
  - `crossLoans` — prestiti incrociati Fabio↔Giulia + righe di pareggio. Solo per rebalancing.
  - `jointIncome` — entrate sul cointestato o buoni pasto. Per `dynamicBudget` e `currentMonthContributions`.
- ✅ **F1.1 (BUG-7)** `handleSettlement` ora salva `account_id` del conto debitore, usa `endOfMonth(selectedMonth)` come data, e inserisce `Math.abs(netBalance) * 2`.
  - ⚠️ **Il `* 2` è intenzionale** (non rifattorizzare): il pareggio entra in `fabioForGiulia`/`giuliaForFabio` che la formula `(fabioTot − giuliaTot)/2` divide per 2. Per azzerare un netBalance N serve quindi un trasferimento di 2N. Vedi commento inline nel codice.
- ✅ **F1.2 (BUG-11)** in `rebalanceData.currentMonthExpenses` ora `isFromJointOrMealVoucher` esclude anche i conti "buoni pasto" oltre al joint puro.
- ✅ **F1.3 (BUG-1)** consumatori aggiornati: `categoryData`, `dynamicBudget`, `familyMemberSummary`, `filteredTransactions`, `buoniPastoBalance`, `rebalanceData` ora attingono dalle 3 memo nuove (non più da `familyTransactions`).
- 📐 Formule chiave (riferimento per sessioni future):
  - `currentMonthExpenses = [...groupExpenses, ...crossLoans].filter(month && !isFromJointOrMealVoucher)`
  - `currentMonthContributions = jointIncome.filter(month && joint && !regalo/bonus)`
  - `netBalance = (fabioTot − giuliaTot) / 2`

**DB live:**
- ✅ **F2.1** eliminate 9 righe orfane "Pareggio Spese - marzo 2026" con `account_id NULL` (artefatti BUG-7) — somma 163,57€.
- ✅ Cleanup follow-up: eliminati 7 duplicati di pareggio creati durante test (loop di click "Pareggia Ora" prima del fix `*2`) + 2 pareggi automatici da test successivi.
- ⏳ **F2.2** non eseguita: 53 righe `category_id NULL` lasciate come-sono. Distribuzione: marzo 2026 (34 righe, 64%), payer Giulia (87%), conti misti, somma 2.801,89€. Da triagare manualmente in pagina Transazioni.

**Riferimenti riga aggiornati (post-refactor):**
- `groupExpenses` / `crossLoans` / `jointIncome` definite circa righe 58-103
- `dynamicBudget` circa 343-365 (usa `jointIncome` per fonti joint, `transactions` filtrato per bonus su personali)
- `rebalanceData` circa 425-482
- `contributionStatus` circa 484-509
- `handleSettlement` circa 511-545

**Bug aperti (per sessioni future):** BUG-2, BUG-3, BUG-4, BUG-5, BUG-6, BUG-8, BUG-9, BUG-10, BUG-12, BUG-13, BUG-14, BUG-15. Anche D2 (54 righe `category_id NULL`).

### Sessione income-detection — 2026-04-25 ✅ COMPLETATA

**Cluster risolto:** BUG-2, BUG-3, BUG-4 (FASE 3.1).

**Decisione architetturale:** scelta opzione A (helper TS centralizzato) su opzione B (flag DB `is_contribution`). Motivi: B richiede UI di gestione categorie ex-novo (oggi inesistente), e non elimina comunque il bisogno di match testuale per descrizioni libere. A è reversibile e fa da trampolino verso B in futuro.

**Codice:**
- ✅ **Nuovo file** [src/lib/incomeClassification.ts](src/lib/incomeClassification.ts) con due helper:
  - `isExternalIncome(t)` — true per income con keyword esterna (regalo, bonus, assegno unico/familiare, INPS, cashback, rimborso). Le keyword "contributo" (giroconto/quota/apporto) hanno precedenza e tornano false.
  - `isJointContribution(t)` — true per income che atterra su conto joint (`owner_id === null`) e NON è external.
  - ⚠️ **Stipendio NON è in EXTERNAL_INCOME_KEYWORDS** per scelta esplicita: stipendio su conto personale resta privato; stipendio girato sul joint diventa contributo (non matcha keyword).
- ✅ **BUG-3+4 fix** in `currentMonthContributions` (~righe 449-453): rimossa blacklist inline `includes('regalo')||includes('bonus')`, sostituita con `isJointContribution(t)`. Ora copre anche INPS, cashback, rimborso, assegno unico/familiare.
- ✅ **dynamicBudget semplificato** (~righe 344-350): rimosso ramo `incomeFromBonus` su conti personali. Per decisione utente, il budget famiglia è SOLO `jointIncome` del mese (income che atterra su Fideuram condiviso o buoni pasto). Bonus/regali su conti personali NON entrano nel budget famiglia. Dipendenza `transactions` rimossa dalla useMemo.
- ✅ **BUG-2 fix** in `contributionStatus` (~righe 480-498): rimossa whitelist `fideuramNames = ["Fideuram Cointestato", "Fideuram condiviso"]` (risolve anche un pezzo di BUG-9). La quota ≥600€ ora si accende solo se `isJointContribution(t)` è true → un bonus INPS di 1.200€ sul Fideuram NON accende più la quota.

**Verifica:**
- ✅ `npx tsc --noEmit` clean.
- ✅ Grep `includes('regalo'|'bonus'|'inps'|...)` su Dashboard.tsx → 0 match residui.

**Riferimenti riga aggiornati (post income-detection):**
- `groupExpenses` / `crossLoans` / `jointIncome` ~ righe 58-97
- `dynamicBudget` ~ righe 344-350 (semplificato)
- `rebalanceData.currentMonthContributions` ~ righe 449-453
- `contributionStatus` ~ righe 478-498

**Bug aperti (per sessioni future):** BUG-5, BUG-6, BUG-8, BUG-9 (residuo: stringhe magic Fideuram in altri punti? da verificare), BUG-10, BUG-12, BUG-13, BUG-14, BUG-15. Anche D2.

### Sessione consistency — 2026-04-25 ✅ COMPLETATA

**Cluster risolto:** BUG-5, BUG-8, BUG-9 (residui), BUG-10, BUG-12, BUG-13 (FASE 3.2-3.7).

**Codice (Dashboard.tsx):**
- ✅ **BUG-5 (TZ)** sostituiti tutti i confronti `getMonth()/getFullYear()` con `format(d, "yyyy-MM") === format(selectedMonth, "yyyy-MM")` in: `familyMemberSummary`, `categoryData`, `rebalanceData.isInSelectedMonth`, `contributionStatus`. Le occorrenze in `processFixedItems` sono costruzioni di Date locali (non confronti) e restano invariate.
- ✅ **BUG-8 (settlement/quota date)** `handleRecordContribution` ora usa `format(endOfMonth(selectedMonth),'yyyy-MM-dd')` come data, non più `now`. (`handleSettlement` era già stato sistemato in hotfix-F1.)
- ✅ **BUG-9 (residui Fideuram per nome)**: rimossi gli ultimi due punti di whitelist:
  - `stats.isFromFideuram` (filtro `fideuram|condiviso` sul nome) → sostituito con `isFromJoint` (`owner_id === null`). Aggiornato l'uso in `income`, `expense`, `prevIncome`, `prevExpense`.
  - `handleRecordContribution.fideuramNames` array → sostituito con lookup `accounts.find(a => a.owner_id === null)`.
  - L'unica stringa "Fideuram" residua è dentro la **descrizione** delle quote ("Quota Mensile Fideuram (Automatico)") — non è un identificatore di conto, è il testo mostrato all'utente. Lasciata. Idem in AddTransactionModal (display label remap, non logica).
- ✅ **BUG-10 (hardcoding fabio/giulia)**: introdotto pattern `members.filter(m => m.role==='parent').sort(...)` ordinato per id (`localeCompare` per gestire UUID stringa). Applicato a `rebalanceData`, `contributionStatus`, e nel render (`parent1`/`parent2` derivati una volta sola, riusati nei pulsanti quota e nella sezione "Pagine Membro"). Comportamento a 2 adulti preservato; il primo per id finisce nello slot "fabio", il secondo in "giulia".
- ✅ **BUG-12 (giroconto case-sensitive)** in `handleRecordContribution`: `c.name.includes('Giroconto')` → `c.name.toLowerCase().includes('giroconto')`. Le altre 3 occorrenze (in `groupExpenses`, `crossLoans`, `stats.isFamilyOrChildExpense`) erano già case-insensitive.
- ✅ **BUG-13 (doppio click quota)**: aggiunto `useState isSubmittingQuota`, guard early-return in `handleRecordContribution`, `finally { setIsSubmittingQuota(false) }`. I pulsanti UI ora hanno `disabled={... || isSubmittingQuota}`.

**DB / Migration:**
- ✅ **Nuovo file** [migration_quota_unique.sql](migration_quota_unique.sql) e ✅ **applicato a Supabase**: partial unique index `uq_quota_mensile_per_payer_month` su `(payer_id, family_id, EXTRACT(YEAR FROM date)*100+EXTRACT(MONTH FROM date), description)` filtrato a `type='income' AND description ILIKE 'Quota Mensile Fideuram%'`.
- 📝 Note di percorso (per future migration con espressioni su `date`):
  - Tentativo iniziale con `to_char(date,'YYYY-MM')` rigettato da Postgres (`42P17 functions in index expression must be marked IMMUTABLE`): `to_char` non è IMMUTABLE quando applicata al tipo `date`. `EXTRACT` invece sì.
  - Il check duplicati iniziale ha rivelato 2 mesi con doppia quota (gen-26, apr-26) — NON artefatti del bug, ma **quote manuali "extra"** legittime con descrizione diversa. Per non eliminarle, la chiave dell'indice include `description`: due "(Automatico)" stesso mese sono bloccate, ma "(Automatico)" + "extra fabio" coesistono.

**Verifica:**
- ✅ `npx tsc --noEmit` clean.
- ✅ Grep `getMonth()/getFullYear()` su Dashboard.tsx → solo 4 occorrenze residue, tutte in `processFixedItems` (costruzioni di Date, non confronti).
- ✅ Grep `Fideuram` su src/ → restano solo: descrizione testuale quota, label di display in AddTransactionModal, commento in bankStatementParser, commento in reconciliation/page. Nessun residuo logico.
- ✅ Grep `'fabio'|'giulia'` (lowercased) su Dashboard.tsx → 0 match.
- ✅ Grep `includes('Giroconto'` (case-sensitive) su src/ → 0 match.

**Riferimenti riga aggiornati (post consistency):**
- `groupExpenses`/`crossLoans`/`jointIncome` ~ righe 56-98
- `stats.isFromJoint` ~ righe 242-243
- `rebalanceData` ~ righe 410-460 (parents ordinati per id)
- `contributionStatus` ~ righe 463-488
- `handleRecordContribution` ~ righe 526-588 (con guard `isSubmittingQuota`)
- `parents`/`parent1`/`parent2` derivati nel render ~ riga 587

**Bug aperti (per sessioni future):** BUG-6 (terzo adulto, edge case), BUG-14 (anti-pattern useState init in reconciliation), BUG-15 (`family_id.is.null` legacy), D2 (53 righe `category_id NULL`). Anche D5 (RLS).

### Sessione hardening — 2026-04-25 ✅ COMPLETATA (codice) / 📋 PIANIFICATA (D5)

**Cluster risolto:** BUG-14, BUG-15, BUG-6 (FASE 4.1-4.3). D5 prodotto come piano scritto, NON applicato.

**Codice:**
- ✅ **BUG-14** in [src/app/reconciliation/page.tsx](src/app/reconciliation/page.tsx): sostituito `useState(() => fetchAccounts())` con `useEffect(() => { fetchAccounts(); }, [fetchAccounts])` (~righe 41-43). Aggiunto `useEffect` agli import.
- ✅ **BUG-15** in [src/components/Dashboard.tsx](src/components/Dashboard.tsx) `fetchData` (~righe 107-114): rimosso fallback `family_id.is.null` dalla query transactions, sostituita la `.or()` con `.eq("family_id", member.family_id)`. Verifica preliminare via REST: `count(*) FROM transactions WHERE family_id IS NULL` = **0** → safe da rimuovere. Il guard `if (!member?.family_id) return;` a inizio funzione garantisce la presenza del valore.
- ✅ **BUG-6** in [src/components/Dashboard.tsx](src/components/Dashboard.tsx): documentata l'assunzione "2 adulti" come blocco commento sopra `rebalanceData` (~riga 405). Aggiunto `console.warn` condizionato a `parents.length > 2` (1 sola occorrenza in `rebalanceData` per evitare spam: la useMemo si rivaluta solo al cambio di `members`). In `contributionStatus` e nel render derivato di `parent1`/`parent2` aggiunto solo un commento di rimando alla nota canonica. **Nessun cambio di firma o comportamento**: il ramo "3 adulti" non è stato implementato (out of scope).

**D5 (sicurezza/RLS) — PIANIFICATA, NON APPLICATA:**
- ✅ Generato [SECURITY_PLAN.md](SECURITY_PLAN.md) con 6 step:
  - **Step 0** — rotazione `service_role` key (esposta in chat il 2026-04-25) + `anon` key. Priorità massima, indipendente dal resto.
  - **Step 1** — introduzione vero login Supabase Auth (oggi `AuthContext` è solo localStorage, nessuna chiamata `supabase.auth.*`). Mapping `family_members.user_id` per Fabio e Giulia è **già popolato** in DB; figli/pet a NULL ma non serve login per loro.
  - **Step 2** — definizione policy RLS basate su `family_id` su 7 tabelle (transactions, accounts, categories, family_members, families, fixed_items, monthly_summary VIEW).
  - **Step 3** — test in staging (clone DB + 2ª famiglia di test).
  - **Step 4** — rollout in produzione con backup + script rollback.
  - **Step 5** — hardening complementare (audit log, CSP, rate limit, eliminazione `remove_auth.sql` dal repo).
- ⚠️ Codice/DB/policy NON modificati in questa sessione. L'esecuzione richiede approvazione esplicita per step.

**Verifica:**
- ✅ `npx tsc --noEmit` clean.
- ✅ DB live: `transactions WHERE family_id IS NULL` count = 0 (verificato via REST prima di rimuovere il fallback).

**Bug aperti (per sessioni future):** D2 (53 righe `category_id NULL` da triagare manualmente in pagina Transazioni — non scope di questa sessione). Tutto il resto dei BUG-* dell'audit originale risulta risolto. D5 attende esecuzione del SECURITY_PLAN (Step 0 da fare immediatamente).
