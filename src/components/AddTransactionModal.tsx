"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { FamilyMember, Category, TransactionType, Account, Transaction } from "@/lib/types";
import { X, Euro, Calendar as CalendarIcon, FileText, User, Tag, TrendingUp, TrendingDown, Plus, Sparkles, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AddTransactionModalProps {
    onClose: () => void;
    onSuccess: () => void;
    initialIsRecurring?: boolean;
    transactionToEdit?: Transaction | null;
}

export function AddTransactionModal({ onClose, onSuccess, initialIsRecurring = false, transactionToEdit }: AddTransactionModalProps) {
    const { member } = useAuth();
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);

    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [type, setType] = useState<TransactionType>("expense");
    const [categoryId, setCategoryId] = useState("");
    const [payerId, setPayerId] = useState("");
    const [beneficiaryId, setBeneficiaryId] = useState(""); // "" means Family
    const [accountId, setAccountId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isRecurring, setIsRecurring] = useState(initialIsRecurring);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const isEditMode = !!transactionToEdit;

    useEffect(() => {
        async function fetchData() {
            if (!member?.family_id) return;

            const { data: m } = await supabase.from("family_members").select("*").eq("family_id", member.family_id).order("name");
            const { data: c } = await supabase.from("categories").select("*").eq("family_id", member.family_id).order("name");
            const { data: a } = await supabase.from("accounts").select("*").eq("family_id", member.family_id).order("name");
            const { data: txs } = await supabase.from("transactions").select("description, category_id, type").eq("family_id", member.family_id).order('created_at', { ascending: false }).limit(100);

            if (m) setMembers(m);
            if (c) setCategories(c);
            if (a) {
                setAccounts(a);
                if (a.length > 0) setAccountId(a[0].id);
            }
            if (txs) setAllTransactions(txs);

            if (member.id) {
                setPayerId(member.id);
            } else if (m?.length) {
                const firstParent = m.find(member => member.role === 'parent');
                setPayerId(firstParent ? firstParent.id : m[0].id);
            }
        }
        fetchData();
    }, [member?.family_id, member?.id]);

    // Pre-populate fields when editing
    useEffect(() => {
        if (transactionToEdit) {
            setAmount(transactionToEdit.amount.toString());
            setDescription(transactionToEdit.description || "");
            setType(transactionToEdit.type);
            setCategoryId(transactionToEdit.category_id || "");
            setPayerId(transactionToEdit.payer_id || "");
            setBeneficiaryId(transactionToEdit.beneficiary_id || "");
            setAccountId(transactionToEdit.account_id || "");
            setDate(transactionToEdit.date);
            // Don't allow recurring toggle in edit mode
            setIsRecurring(false);
        }
    }, [transactionToEdit]);

    // 1. Sync Payer based on Account (Primary Logic) - DISABLED in edit mode
    useEffect(() => {
        if (isEditMode) return; // Skip auto-sync in edit mode
        if (accountId && accounts.length > 0) {
            const account = accounts.find(a => a.id === accountId);
            if (account) {
                if (account.owner_id) {
                    // Personal account: Payer is the owner
                    setPayerId(account.owner_id);
                } else {
                    // Joint account: Payer is the current member
                    if (member?.id) {
                        setPayerId(member.id);
                    } else {
                        const firstParent = members.find(m => m.role === 'parent');
                        if (firstParent) setPayerId(firstParent.id);
                    }
                }
            }
        }
    }, [accountId, accounts, members, member?.id, isEditMode]);

    // 2. Automate beneficiary for Joint account income - DISABLED in edit mode
    useEffect(() => {
        if (isEditMode) return; // Skip auto-sync in edit mode
        if (type === 'income' && accountId) {
            const account = accounts.find(a => a.id === accountId);
            if (account && account.owner_id === null) {
                setBeneficiaryId(""); // Family / Comune
            }
        }
    }, [accountId, type, accounts, isEditMode]);

    // 3. Automate beneficiary for Salary category - DISABLED in edit mode
    useEffect(() => {
        if (isEditMode) return; // Skip auto-sync in edit mode
        if (type === 'income' && categoryId) {
            const cat = categories.find(c => c.id === categoryId);
            if (cat && (cat.name.toLowerCase().includes('stipendio') || cat.name.toLowerCase().includes('salario'))) {
                setBeneficiaryId(payerId);
            }
        }
    }, [categoryId, type, payerId, categories, isEditMode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(false); // Reset just in case

        const isTransfer = categories.find(c => c.id === categoryId)?.name.toLowerCase().includes('giroconto');

        setLoading(true);

        if (isEditMode && transactionToEdit) {
            // UPDATE existing transaction
            const { error } = await supabase
                .from("transactions")
                .update({
                    amount: parseFloat(amount),
                    description,
                    type,
                    category_id: categoryId || null,
                    payer_id: payerId,
                    beneficiary_id: beneficiaryId || null,
                    account_id: accountId || null,
                    date
                })
                .eq("id", transactionToEdit.id);

            if (error) {
                alert("Errore: " + error.message);
            } else {
                onSuccess();
                onClose();
            }
        } else {
            // INSERT new transaction(s)
            const transactionsToInsert = [];

            // Primary Transaction
            transactionsToInsert.push({
                amount: parseFloat(amount),
                description,
                type,
                category_id: categoryId || null,
                payer_id: payerId,
                beneficiary_id: beneficiaryId || null,
                account_id: accountId || null,
                family_id: member?.family_id,
                date
            });

            // If it's a transfer and we have an account selected, we might want a counter-transaction
            // Special case: Quota 600€ - It's a transfer from Personal to Shared
            if (description === 'Quota Mensile Fideuram' && type === 'income') {
                const personalAccount = accounts.find(a => a.owner_id === payerId);
                const giroCategoryExpense = categories.find(c => c.name.toLowerCase().includes('giroconto') && c.type === 'expense');

                if (personalAccount && giroCategoryExpense) {
                    transactionsToInsert.push({
                        amount: parseFloat(amount),
                        description: `Uscita Quota: ${description}`,
                        type: 'expense',
                        category_id: giroCategoryExpense.id,
                        payer_id: payerId,
                        beneficiary_id: null,
                        account_id: personalAccount.id,
                        family_id: member?.family_id,
                        date
                    });
                }
            }

            const { error } = await supabase.from("transactions").insert(transactionsToInsert);

            if (error) {
                alert("Errore: " + error.message);
            } else {
                // If recurring... (only for the first one usually)
                if (isRecurring) {
                    await supabase.from("fixed_items").insert({
                        amount: parseFloat(amount),
                        description,
                        type,
                        category_id: categoryId || null,
                        payer_id: payerId,
                        beneficiary_id: beneficiaryId || null,
                        account_id: accountId || null,
                        family_id: member?.family_id,
                        frequency: 'monthly',
                        active: true,
                        next_generation_date: date // Use the selected date as the first anchor
                    });
                }
                onSuccess();
                onClose();
            }
        }
        setLoading(false);
    };

    const filteredCategories = useMemo(() => {
        const cats = categories.filter(c => c.type === type);
        // Rule: Children can only have 'Regalo' for income
        const selectedPayer = members.find(m => m.id === payerId);
        if (type === 'income' && selectedPayer?.role === 'child') {
            return cats.filter(c => c.name.toLowerCase().includes('regalo'));
        }
        return cats;
    }, [categories, type, payerId, members]);

    const handleQuickIncome = (incomeType: 'stipendio' | 'quota' | 'bonus') => {
        setType('income');
        if (incomeType === 'stipendio') {
            const cat = categories.find(c => c.name.toLowerCase().includes('stipendio') || c.name.toLowerCase().includes('salario'));
            if (cat) setCategoryId(cat.id);
            setDescription('Stipendio Mensile');
            // Salary is for the person who earns it
            setBeneficiaryId(payerId);
        } else if (incomeType === 'quota') {
            setAmount('600');
            setDescription('Quota Mensile Fideuram');
            const fideuramAcct = accounts.find(a =>
                a.name.toLowerCase().includes('fideuram') ||
                a.name.toLowerCase().includes('condiviso')
            );
            if (fideuramAcct) setAccountId(fideuramAcct.id);
            const cat = categories.find(c => c.name.toLowerCase().includes('giroconto') || c.name.toLowerCase().includes('apporto'));
            if (cat) setCategoryId(cat.id);
        } else if (incomeType === 'bonus') {
            setDescription('Assegno Unico / Bonus');
            const fideuramAcct = accounts.find(a =>
                a.name.toLowerCase().includes('fideuram') ||
                a.name.toLowerCase().includes('condiviso')
            );
            if (fideuramAcct) setAccountId(fideuramAcct.id);
            const cat = categories.find(c => c.name.toLowerCase().includes('bonus') || c.name.toLowerCase().includes('assegno'));
            if (cat) setCategoryId(cat.id);
        }
    };

    const suggestions = useMemo(() => {
        if (description.length < 2) return [];
        const unique = new Set();
        return allTransactions
            .filter(t => t.description?.toLowerCase().includes(description.toLowerCase()))
            .filter(t => {
                if (unique.has(t.description.toLowerCase())) return false;
                unique.add(t.description.toLowerCase());
                return true;
            })
            .slice(0, 5);
    }, [description, allTransactions]);

    const selectSuggestion = (s: any) => {
        setDescription(s.description);
        if (s.category_id) setCategoryId(s.category_id);
        if (s.type) setType(s.type);
        setShowSuggestions(false);
    };
    // Only parents can be payers for income (usually)
    const possiblePayers = members;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white w-full h-full md:h-auto md:max-w-2xl p-6 md:p-8 md:rounded-[2rem] shadow-2xl animate-fade-in-up border border-white relative overflow-y-auto md:overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>

                <div className="flex justify-between items-center mb-8 relative">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{isEditMode ? "Modifica Operazione" : "Nuova Operazione"}</h2>
                        <p className="text-slate-400 text-sm font-medium">{isEditMode ? "Modifica i dettagli dell'operazione." : "Aggiungi un'entrata o un'uscita al budget."}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all border border-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8 relative">
                    {/* Toggle Switch */}
                    <div className="flex p-1.5 bg-slate-100/50 rounded-2xl border border-slate-100">
                        <button
                            type="button"
                            onClick={() => setType("expense")}
                            className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${type === "expense" ? "bg-white text-rose-500 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                }`}
                        >
                            <TrendingDown size={16} /> Spesa
                        </button>
                        <button
                            type="button"
                            onClick={() => setType("income")}
                            className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${type === "income" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                }`}
                        >
                            <TrendingUp size={16} /> Entrata
                        </button>
                    </div>

                    {type === 'income' && (
                        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
                            <button type="button" onClick={() => handleQuickIncome('stipendio')} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100/50">Stipendio</button>
                            <button type="button" onClick={() => handleQuickIncome('quota')} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100/50">Quota 600€</button>
                            <button type="button" onClick={() => handleQuickIncome('bonus')} className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-100/50">INPS / Bonus</button>
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* Amount - Hero Input */}
                        <div className="relative group">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Importo (€)</label>
                            <div className="relative">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                                    <Euro size={32} />
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] py-8 pl-18 pr-6 text-4xl font-black text-slate-900 focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all placeholder:text-slate-200"
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descrizione</label>
                                <div className="relative">
                                    <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => {
                                            setDescription(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        className="w-full bg-slate-50 border border-slate-50 rounded-xl p-4 pl-11 text-slate-800 font-bold focus:bg-white focus:border-indigo-100 outline-none transition-all placeholder:text-slate-300 text-sm"
                                        placeholder="Cosa hai comprato?"
                                    />
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                            {suggestions.map((s: any, idx: number) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => selectSuggestion(s)}
                                                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-all text-left border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Search size={14} className="text-slate-300" />
                                                        <span className="text-sm font-black text-slate-700">{s.description}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg">Recente</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                    {type === 'expense' ? 'Conto e Pagatore (Da dove escono?)' : 'Conto e Membro (Dove entrano?)'}
                                </label>
                                <div className="relative">
                                    <Euro size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <select
                                        value={accountId}
                                        onChange={(e) => setAccountId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-50 rounded-xl p-4 pl-11 text-slate-800 font-bold outline-none focus:bg-white focus:border-indigo-100 appearance-none cursor-pointer text-sm shadow-sm hover:bg-white transition-all"
                                    >
                                        {accounts.map(a => {
                                            const owner = members.find(m => m.id === a.owner_id);
                                            // Mapping names for display as requested
                                            let displayName = a.name;
                                            if (a.name === 'C/C Fabio') displayName = 'Fabio';
                                            if (a.name === 'C/C Giulia') displayName = 'Giulia';
                                            if (a.name === 'Fideuram Cointestato') displayName = 'Fideuram condiviso';
                                            if (a.name === 'Buoni Pasto Fabio') displayName = 'Buoni pasto Fabio';

                                            // Fallback for custom user requests if DB names already changed
                                            if (a.name === 'Fabio') displayName = 'Fabio';
                                            if (a.name === 'Giulia') displayName = 'Giulia';
                                            if (a.name === 'Fideuram condiviso') displayName = 'Fideuram condiviso';
                                            if (a.name === 'Buoni pasto Fabio') displayName = 'Buoni pasto Fabio';

                                            return (
                                                <option key={a.id} value={a.id}>
                                                    {displayName}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                        <Sparkles size={14} className="animate-pulse" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Beneficiario (Per chi è?)</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    {accounts.find(a => a.id === accountId)?.owner_id === null && type === 'income' ? (
                                        <div className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 pl-11 text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                            <Sparkles size={14} /> Automatico (Famiglia)
                                        </div>
                                    ) : (
                                        <select
                                            value={beneficiaryId}
                                            onChange={(e) => setBeneficiaryId(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-50 rounded-xl p-4 pl-11 text-slate-800 font-bold outline-none focus:bg-white focus:border-indigo-100 appearance-none cursor-pointer text-sm"
                                        >
                                            <option value="">Tutta la Famiglia</option>
                                            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>


                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoria</label>
                                <div className="relative">
                                    <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <select
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-50 rounded-xl p-4 pl-11 text-slate-800 font-bold outline-none focus:bg-white focus:border-indigo-100 appearance-none cursor-pointer text-sm"
                                    >
                                        <option value="">Altro</option>
                                        {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data</label>
                                <div className="relative">
                                    <CalendarIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-50 rounded-xl p-4 pl-11 text-slate-800 font-bold outline-none focus:bg-white focus:border-indigo-100 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Recurring Checkbox - disabled in edit mode */}
                        {type === 'expense' && !isEditMode && (
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => setIsRecurring(!isRecurring)}>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isRecurring ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}>
                                    {isRecurring && <Plus size={14} className="text-white" />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-black text-slate-800">Spesa ricorrente</p>
                                    <p className="text-[10px] font-bold text-slate-400">Verrà salvata come modello per i mesi futuri.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 pt-4 relative z-10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 border border-slate-200 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-600 transition-all"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-[2] py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 ${type === 'expense'
                                ? 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700'
                                : 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700'
                                }`}
                        >
                            {loading ? "Salvataggio..." : (isEditMode ? "Aggiorna Operazione" : "Salva Operazione")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
