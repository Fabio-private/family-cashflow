export type TransactionType = 'expense' | 'income';
export type FrequencyType = 'monthly' | 'yearly';
export type MemberRole = 'parent' | 'child' | 'pet';

export interface FamilyMember {
    id: string;
    name: string;
    avatar_url?: string;
    role: MemberRole;
    user_id?: string | null;
    family_id: string;
    created_at: string;
}

export interface Account {
    id: string;
    name: string;
    owner_id: string | null; // NULL for joint
    family_id: string;
    created_at: string;
}

export interface Category {
    id: string;
    name: string;
    type: TransactionType;
    family_id: string;
    created_at: string;
}

export interface Transaction {
    id: string;
    created_at: string;
    amount: number;
    description: string;
    type: TransactionType;
    category_id: string;
    payer_id: string;
    beneficiary_id: string | null; // NULL means "Whole Family"
    account_id: string;
    family_id: string;
    date: string;
    // Joins
    categories?: Category;
    payer?: FamilyMember;
    beneficiary?: FamilyMember;
    accounts?: Account;
}

export interface FixedItem {
    id: string;
    amount: number;
    description: string;
    type: TransactionType;
    payer_id: string;
    beneficiary_id: string | null;
    account_id: string;
    category_id: string | null;
    frequency: FrequencyType;
    active: boolean;
    family_id: string;
    next_generation_date: string;
    created_at: string;
}

export interface MonthlySummary {
    month: string;
    member_name: string;
    type: TransactionType;
    total_amount: number;
}

// Bank Reconciliation Types
export interface BankTransaction {
    id: string; // temporary ID
    date: string;
    description: string;
    amount: number;
    balance?: number;
    raw: any; // original data from CSV
}

export type ReconciliationStatus = 'matched' | 'unmatched_bank' | 'unmatched_app' | 'discrepancy';

export interface ReconciliationMatch {
    bankTransaction: BankTransaction;
    appTransaction?: Transaction;
    matchScore: number; // 0-100
    status: ReconciliationStatus;
    issues?: string[]; // e.g., ["Amount differs by €0.50", "Date differs by 1 day"]
}

export interface ReconciliationResult {
    matched: ReconciliationMatch[];
    unmatchedBank: BankTransaction[];
    unmatchedApp: Transaction[];
    summary: {
        totalBank: number;
        totalApp: number;
        matched: number;
        unmatchedBank: number;
        unmatchedApp: number;
        balanceDifference: number;
    };
}

export interface ColumnMapping {
    dateColumn: number; // column index
    descriptionColumn: number;
    amountColumn: number;
    balanceColumn?: number;
}

export interface MatchingOptions {
    dateTolerance: number; // days
    amountTolerance: number; // euros
    useFuzzyMatching: boolean;
}

