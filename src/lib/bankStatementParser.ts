import * as XLSX from 'xlsx';
import { BankTransaction } from './types';

/**
 * Parse Excel file from Fideuram bank statements
 * Uses simple approach: only DATE and AMOUNT for matching
 */
export async function parseExcelFile(file: File): Promise<BankTransaction[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convert to array of arrays
                const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    raw: false,
                    defval: null
                });

                // Find header row and data rows
                const transactions: BankTransaction[] = [];

                // Skip empty rows and look for data
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];

                    // Skip completely empty rows
                    if (!row || row.every(cell => !cell)) continue;

                    // Try to parse as transaction
                    // Expected format: [Date, Description, Currency, Amount, ...]
                    const dateStr = row[0];
                    const description = row[1] || '';
                    const amountStr = row[3]; // Amount is usually in column 3 or 4

                    // Validate date and amount
                    if (dateStr && amountStr) {
                        const parsedDate = parseDateString(dateStr);
                        const parsedAmount = parseAmountString(amountStr);

                        if (parsedDate && !isNaN(parsedAmount)) {
                            transactions.push({
                                id: `bank_${i}_${Date.now()}`,
                                date: parsedDate,
                                description: String(description).trim(),
                                amount: parsedAmount,
                                raw: row
                            });
                        }
                    }
                }

                resolve(transactions);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsBinaryString(file);
    });
}

/**
 * Parse date string from Excel (handles various formats)
 */
function parseDateString(dateStr: string | number): string | null {
    if (!dateStr) return null;

    try {
        // If it's an Excel serial date number
        if (typeof dateStr === 'number') {
            const date = XLSX.SSF.parse_date_code(dateStr);
            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }

        // If it's a string, try to parse it
        const str = String(dateStr).trim();

        // Try DD/MM/YYYY format (common in Italy)
        const ddmmyyyyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyyMatch) {
            const [, day, month, year] = ddmmyyyyMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Try YYYY-MM-DD format
        const yyyymmddMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (yyyymmddMatch) {
            const [, year, month, day] = yyyymmddMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Try parsing as Date
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Parse amount string (handles negative values, decimals, currency symbols)
 */
function parseAmountString(amountStr: string | number): number {
    if (typeof amountStr === 'number') return amountStr;
    if (!amountStr) return NaN;

    // Remove currency symbols, spaces, and convert comma to dot
    const cleaned = String(amountStr)
        .replace(/[€$£\s]/g, '')
        .replace(',', '.');

    return parseFloat(cleaned);
}
