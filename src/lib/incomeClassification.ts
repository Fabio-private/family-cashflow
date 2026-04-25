import { Transaction } from './types';

// Income "esterno": denaro che entra dall'esterno del patrimonio della coppia
// (regali, INPS, bonus, cashback, rimborsi). NON è un contributo personale al
// cointestato anche se atterra sul cointestato. Lo stipendio NON è qui: girato
// sul joint vale come contributo personale; su conto personale resta privato.
const EXTERNAL_INCOME_KEYWORDS = [
    'regalo',
    'bonus',
    'assegno unico',
    'assegno familiare',
    'inps',
    'cashback',
    'rimborso',
];

// Trasferimenti personali → cointestato: contano come contributo del payer.
// Hanno priorità sulle keyword "external" (es. una "Quota stipendio" rimane contributo).
const CONTRIBUTION_KEYWORDS = ['giroconto', 'quota', 'apporto'];

const matchesAny = (haystack: string, keywords: string[]) =>
    keywords.some(k => haystack.includes(k));

const buildHaystack = (t: Transaction) =>
    `${t.categories?.name ?? ''} ${t.description ?? ''}`.toLowerCase();

// True se l'income è "esterno" (regalo/bonus/INPS/cashback/rimborso/stipendio).
// I trasferimenti personali (giroconto/quota/apporto) hanno precedenza e tornano false.
export function isExternalIncome(t: Transaction): boolean {
    if (t.type !== 'income') return false;
    const hay = buildHaystack(t);
    if (matchesAny(hay, CONTRIBUTION_KEYWORDS)) return false;
    return matchesAny(hay, EXTERNAL_INCOME_KEYWORDS);
}

// True se l'income è un contributo personale di un coniuge verso il conto cointestato.
// Richiede: income, atterra su conto joint, e NON è income esterno.
export function isJointContribution(t: Transaction): boolean {
    if (t.type !== 'income') return false;
    const isJoint = t.accounts?.owner_id === null;
    if (!isJoint) return false;
    return !isExternalIncome(t);
}
