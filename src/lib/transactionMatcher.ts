import { BankTransaction, Transaction, ReconciliationMatch, ReconciliationResult, MatchingOptions } from './types';

/**
 * Match bank transactions with app transactions
 * Simple approach: matches based on AMOUNT and DATE only (with tolerance)
 */
export function matchTransactions(
    bankTxs: BankTransaction[],
    appTxs: Transaction[],
    options: MatchingOptions = {
        dateTolerance: 2, // ±2 days
        amountTolerance: 0.01, // ±0.01 euros (for rounding errors)
        useFuzzyMatching: false // Not used in simplified approach
    }
): ReconciliationResult {
    const matched: ReconciliationMatch[] = [];
    const unmatchedBank: BankTransaction[] = [];
    const unmatchedApp: Transaction[] = [];

    // Track which app transactions have been matched
    const matchedAppIds = new Set<string>();

    // For each bank transaction, try to find a match
    for (const bankTx of bankTxs) {
        let bestMatch: { tx: Transaction; score: number } | null = null;

        for (const appTx of appTxs) {
            // Skip already matched transactions
            if (matchedAppIds.has(appTx.id)) continue;

            // Check if amounts match (within tolerance)
            const amountMatch = Math.abs(Math.abs(bankTx.amount) - appTx.amount) <= options.amountTolerance;
            if (!amountMatch) continue;

            // Check if dates match (within tolerance)
            const daysDiff = Math.abs(dateDifferenceInDays(bankTx.date, appTx.date));
            if (daysDiff > options.dateTolerance) continue;

            // Calculate match score (0-100)
            const score = calculateMatchScore(bankTx, appTx, daysDiff);

            // Keep best match
            if (!bestMatch || score > bestMatch.score) {
                bestMatch = { tx: appTx, score };
            }
        }

        if (bestMatch && bestMatch.score >= 80) {
            // Good match found
            matched.push({
                bankTransaction: bankTx,
                appTransaction: bestMatch.tx,
                matchScore: bestMatch.score,
                status: 'matched',
                issues: bestMatch.score < 100 ? generateIssues(bankTx, bestMatch.tx) : undefined
            });
            matchedAppIds.add(bestMatch.tx.id);
        } else {
            // No match found
            unmatchedBank.push(bankTx);
        }
    }

    // Find unmatched app transactions
    for (const appTx of appTxs) {
        if (!matchedAppIds.has(appTx.id)) {
            unmatchedApp.push(appTx);
        }
    }

    // Calculate summary
    const totalBankAmount = bankTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const totalAppAmount = appTxs.reduce((sum, tx) => sum + tx.amount, 0);

    return {
        matched,
        unmatchedBank,
        unmatchedApp,
        summary: {
            totalBank: bankTxs.length,
            totalApp: appTxs.length,
            matched: matched.length,
            unmatchedBank: unmatchedBank.length,
            unmatchedApp: unmatchedApp.length,
            balanceDifference: totalBankAmount - totalAppAmount
        }
    };
}

/**
 * Calculate difference in days between two dates
 */
function dateDifferenceInDays(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate match score based on how well transactions match
 */
function calculateMatchScore(bankTx: BankTransaction, appTx: Transaction, daysDiff: number): number {
    let score = 100;

    // Penalize for date difference
    score -= daysDiff * 5; // -5 points per day difference

    // Penalize for amount difference (even if within tolerance)
    const amountDiff = Math.abs(Math.abs(bankTx.amount) - appTx.amount);
    if (amountDiff > 0) {
        score -= Math.min(amountDiff * 10, 10); // Up to -10 points
    }

    return Math.max(0, score);
}

/**
 * Generate list of issues/differences between matched transactions
 */
function generateIssues(bankTx: BankTransaction, appTx: Transaction): string[] {
    const issues: string[] = [];

    const daysDiff = dateDifferenceInDays(bankTx.date, appTx.date);
    if (daysDiff > 0) {
        issues.push(`Data differisce di ${daysDiff} giorn${daysDiff === 1 ? 'o' : 'i'}`);
    }

    const amountDiff = Math.abs(Math.abs(bankTx.amount) - appTx.amount);
    if (amountDiff > 0.001) {
        issues.push(`Importo differisce di €${amountDiff.toFixed(2)}`);
    }

    return issues;
}

/**
 * Helper to format bank transaction for display
 */
export function formatBankTransaction(tx: BankTransaction): string {
    const date = new Date(tx.date).toLocaleDateString('it-IT');
    const amount = tx.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    return `${date} - ${tx.description || 'N/A'} - ${amount}`;
}
