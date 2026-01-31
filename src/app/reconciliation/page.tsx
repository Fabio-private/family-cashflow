"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Transaction, BankTransaction, ReconciliationResult, Account } from "@/lib/types";
import { parseExcelFile } from "@/lib/bankStatementParser";
import { matchTransactions } from "@/lib/transactionMatcher";
import { Upload, CheckCircle, AlertTriangle, FileSpreadsheet, TrendingDown, Calendar, Euro } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AddTransactionModal } from "@/components/AddTransactionModal";

export default function ReconciliationPage() {
    const { member } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
    const [transactionToAdd, setTransactionToAdd] = useState<BankTransaction | null>(null);

    // Fetch accounts
    const fetchAccounts = useCallback(async () => {
        if (!member?.family_id) return;
        const { data } = await supabase
            .from("accounts")
            .select("*")
            .eq("family_id", member.family_id)
            .order("name");
        if (data) {
            setAccounts(data);
            // Auto-select Fideuram if exists
            const fideuram = data.find(a => a.name.toLowerCase().includes('fideuram'));
            if (fideuram) setSelectedAccount(fideuram.id);
        }
    }, [member?.family_id]);

    useState(() => {
        fetchAccounts();
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setReconciliationResult(null);
        }
    };

    const handleReconcile = async () => {
        if (!file || !selectedAccount || !member?.family_id) return;

        setIsLoading(true);
        setError(null);

        try {
            // Parse bank statement
            const bankTransactions = await parseExcelFile(file);

            if (bankTransactions.length === 0) {
                throw new Error("Nessuna transazione trovata nel file. Verifica il formato.");
            }

            // Fetch app transactions for selected account
            const { data: appTxs, error: fetchError } = await supabase
                .from("transactions")
                .select("id, created_at, amount, description, type, date, category_id, payer_id, beneficiary_id, account_id, family_id")
                .eq("family_id", member.family_id)
                .eq("account_id", selectedAccount)
                .order("date", { ascending: false });

            if (fetchError) throw fetchError;

            // Perform matching
            const result = matchTransactions(bankTransactions, appTxs || [], {
                dateTolerance: 2,
                amountTolerance: 0.01,
                useFuzzyMatching: false
            });

            setReconciliationResult(result);
        } catch (err: any) {
            setError(err.message || "Errore durante la riconciliazione");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTransaction = (bankTx: BankTransaction) => {
        setTransactionToAdd(bankTx);
    };

    const getFilteredMatches = () => {
        if (!reconciliationResult) return [];

        if (filter === 'matched') {
            return reconciliationResult.matched;
        } else if (filter === 'unmatched') {
            return reconciliationResult.unmatchedBank.map(bankTx => ({
                bankTransaction: bankTx,
                appTransaction: undefined,
                matchScore: 0,
                status: 'unmatched_bank' as const,
                issues: undefined
            }));
        } else {
            // All
            const all = [...reconciliationResult.matched];
            reconciliationResult.unmatchedBank.forEach(bankTx => {
                all.push({
                    bankTransaction: bankTx,
                    appTransaction: undefined,
                    matchScore: 0,
                    status: 'unmatched_bank' as const,
                    issues: undefined
                });
            });
            return all;
        }
    };

    return (
        <div className="space-y-8 animate-up">
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Riconciliazione Estratto Conto</h1>
                <p className="text-slate-500 font-medium mt-1">Confronta l'estratto conto bancario con le transazioni registrate.</p>
            </div>

            {/* Upload Section */}
            <div className="soft-card p-8">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <label className="block text-sm font-black text-slate-700 mb-3 uppercase tracking-widest">
                            Seleziona Conto
                        </label>
                        <select
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-slate-800 font-bold focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50 outline-none"
                        >
                            <option value="">Scegli un conto...</option>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-black text-slate-700 mb-3 uppercase tracking-widest">
                            Carica Estratto Conto (Excel)
                        </label>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label
                                htmlFor="file-upload"
                                className="flex items-center justify-center gap-3 w-full bg-indigo-50 border-2 border-indigo-100 border-dashed rounded-xl p-6 cursor-pointer hover:bg-indigo-100 transition-all"
                            >
                                <Upload size={24} className="text-indigo-600" />
                                <span className="text-sm font-black text-indigo-700">
                                    {file ? file.name : "Clicca per caricare"}
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                        <p className="text-sm font-bold text-rose-700">{error}</p>
                    </div>
                )}

                <button
                    onClick={handleReconcile}
                    disabled={!file || !selectedAccount || isLoading}
                    className="mt-6 w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-100"
                >
                    {isLoading ? "Elaborazione..." : "Avvia Riconciliazione"}
                </button>
            </div>

            {/* Results Section */}
            {reconciliationResult && (
                <>
                    {/* Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="soft-card p-6 bg-emerald-50 border-emerald-100">
                            <div className="flex items-center gap-3 mb-2">
                                <CheckCircle className="text-emerald-600" size={24} />
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Matchate</span>
                            </div>
                            <p className="text-3xl font-black text-emerald-700">{reconciliationResult.summary.matched}</p>
                        </div>

                        <div className="soft-card p-6 bg-amber-50 border-amber-100">
                            <div className="flex items-center gap-3 mb-2">
                                <AlertTriangle className="text-amber-600" size={24} />
                                <span className="text-xs font-black text-amber-600 uppercase tracking-widest">In banca, non in app</span>
                            </div>
                            <p className="text-3xl font-black text-amber-700">{reconciliationResult.summary.unmatchedBank}</p>
                        </div>

                        <div className="soft-card p-6 bg-orange-50 border-orange-100">
                            <div className="flex items-center gap-3 mb-2">
                                <FileSpreadsheet className="text-orange-600" size={24} />
                                <span className="text-xs font-black text-orange-600 uppercase tracking-widest">In app, non in banca</span>
                            </div>
                            <p className="text-3xl font-black text-orange-700">{reconciliationResult.summary.unmatchedApp}</p>
                        </div>

                        <div className="soft-card p-6 bg-indigo-50 border-indigo-100">
                            <div className="flex items-center gap-3 mb-2">
                                <Euro className="text-indigo-600" size={24} />
                                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Differenza</span>
                            </div>
                            <p className="text-3xl font-black text-indigo-700">
                                €{Math.abs(reconciliationResult.summary.balanceDifference).toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            Tutte
                        </button>
                        <button
                            onClick={() => setFilter('matched')}
                            className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${filter === 'matched' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            Matchate
                        </button>
                        <button
                            onClick={() => setFilter('unmatched')}
                            className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${filter === 'unmatched' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            Da verificare
                        </button>
                    </div>

                    {/* Transactions List */}
                    <div className="soft-card p-0 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        <th className="px-6 py-4 text-left">Stato</th>
                                        <th className="px-6 py-4 text-left">Data Banca</th>
                                        <th className="px-6 py-4 text-left">Importo Banca</th>
                                        <th className="px-6 py-4 text-left">Data App</th>
                                        <th className="px-6 py-4 text-left">Importo App</th>
                                        <th className="px-6 py-4 text-left">Note</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {getFilteredMatches().map((match, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                {match.status === 'matched' ? (
                                                    <span className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase w-fit">
                                                        <CheckCircle size={14} /> Match
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2 bg-amber-50 text-amber-700 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase w-fit">
                                                        <AlertTriangle size={14} /> Manca
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">
                                                {format(new Date(match.bankTransaction.date), "dd MMM yyyy", { locale: it })}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-900">
                                                {match.bankTransaction.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-700">
                                                {match.appTransaction ? format(new Date(match.appTransaction.date), "dd MMM yyyy", { locale: it }) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-900">
                                                {match.appTransaction ? match.appTransaction.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {match.issues && match.issues.length > 0 ? (
                                                    <div className="text-[10px] font-bold text-amber-600">
                                                        {match.issues.join(', ')}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {match.status === 'unmatched_bank' && (
                                                    <button
                                                        onClick={() => handleAddTransaction(match.bankTransaction)}
                                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all"
                                                    >
                                                        Aggiungi
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Add Transaction Modal */}
            {transactionToAdd && (
                <AddTransactionModal
                    onClose={() => setTransactionToAdd(null)}
                    onSuccess={() => {
                        setTransactionToAdd(null);
                        handleReconcile(); // Re-run reconciliation
                    }}
                    transactionToEdit={{
                        id: '',
                        created_at: '',
                        amount: Math.abs(transactionToAdd.amount),
                        description: transactionToAdd.description || '',
                        type: transactionToAdd.amount < 0 ? 'expense' : 'income',
                        category_id: '',
                        payer_id: '',
                        beneficiary_id: null,
                        account_id: selectedAccount,
                        family_id: member?.family_id || '',
                        date: transactionToAdd.date
                    } as any}
                />
            )}
        </div>
    );
}
