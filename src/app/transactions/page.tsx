"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Transaction, FamilyMember, Category } from "@/lib/types";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import {
    Search,
    Filter,
    TrendingUp,
    TrendingDown,
    Calendar as CalendarIcon,
    Download,
    Plus,
    MoreHorizontal,
    ArrowUpDown,
    Trash2,
    Edit3,
    Tag,
    User,
    FileText
} from "lucide-react";
import { AddTransactionModal } from "@/components/AddTransactionModal";

export default function TransactionsPage() {
    const { member } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedMember, setSelectedMember] = useState<string>("all");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);

    const fetchData = useCallback(async () => {
        if (!member?.family_id) return;
        setIsLoading(true);

        const { data: mData } = await supabase.from("family_members").select("*").eq("family_id", member.family_id).order("name");
        const { data: cData } = await supabase.from("categories").select("*").eq("family_id", member.family_id).order("name");
        if (mData) setMembers(mData);
        if (cData) setCategories(cData);

        let query = supabase
            .from("transactions")
            .select("id, amount, description, type, date, category_id, payer_id, beneficiary_id, account_id, categories(name), payer:family_members!payer_id(name), beneficiary:family_members!beneficiary_id(name), accounts(name)")
            .eq("family_id", member.family_id)
            .order("date", { ascending: false });

        if (selectedMember !== "all") {
            query = query.or(`payer_id.eq.${selectedMember},beneficiary_id.eq.${selectedMember}`);
        }
        if (selectedCategory !== "all") {
            query = query.eq("category_id", selectedCategory);
        }
        if (selectedMonth) {
            const start = startOfMonth(new Date(selectedMonth));
            const end = endOfMonth(new Date(selectedMonth));
            query = query.gte("date", format(start, "yyyy-MM-dd")).lte("date", format(end, "yyyy-MM-dd"));
        }

        const { data: txData } = await query;
        if (txData) {
            const filtered = (txData as any).filter((tx: any) =>
                (tx.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (tx.categories?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
            );
            setTransactions(filtered);
        }

        setIsLoading(false);
    }, [selectedMember, selectedCategory, selectedMonth, searchTerm, member?.family_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const suggestions = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        const lowerTerm = searchTerm.toLowerCase();

        const memberSugs = members
            .filter(m => m.name.toLowerCase().includes(lowerTerm))
            .map(m => ({ type: 'member', label: m.name, id: m.id }));

        const catSugs = categories
            .filter(c => c.name.toLowerCase().includes(lowerTerm))
            .map(c => ({ type: 'category', label: c.name, id: c.id }));

        const descSugs = Array.from(new Set(transactions.map(tx => tx.description)))
            .filter(desc => desc?.toLowerCase().includes(lowerTerm))
            .map(desc => ({ type: 'description', label: desc, id: desc }));

        return [...memberSugs, ...catSugs, ...descSugs].slice(0, 6);
    }, [searchTerm, members, categories, transactions]);

    const handleDelete = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questa transazione?")) return;
        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (!error) fetchData();
    };

    return (
        <div className="space-y-8 animate-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Portafoglio Storico</h1>
                    <p className="text-slate-500 font-medium mt-1">Gestisci e analizza ogni singola operazione registrata.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all shadow-sm">
                        <Download size={16} /> Export CSV
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                    >
                        <Plus size={18} /> Aggiungi
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="soft-card p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                            type="text"
                            placeholder="Cerca per descrizione..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            onFocus={() => setShowSuggestions(true)}
                            className="w-full bg-slate-50 border-none rounded-xl py-3 pl-10 pr-4 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-100"
                        />

                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                                {suggestions.map((sug, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            if (sug.type === 'member') {
                                                setSelectedMember(sug.id);
                                            } else if (sug.type === 'category') {
                                                setSelectedCategory(sug.id);
                                            } else {
                                                setSearchTerm(sug.label);
                                            }
                                            setShowSuggestions(false);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-all text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                            {sug.type === 'member' ? <User size={14} /> : sug.type === 'category' ? <Tag size={14} /> : <FileText size={14} />}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-slate-800">{sug.label}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{sug.type === 'member' ? 'Filtra Membro' : sug.type === 'category' ? 'Filtra Categoria' : 'Descrizione'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <select
                        value={selectedMember}
                        onChange={(e) => setSelectedMember(e.target.value)}
                        className="bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-100 appearance-none"
                    >
                        <option value="all">Tutti i membri</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-100 appearance-none"
                    >
                        <option value="all">Tutte le categorie</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-100"
                    />
                </div>
            </div>

            {/* Transactions Table */}
            <div className="soft-card p-0 transition-all overflow-hidden border-b-8 border-indigo-600">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <th className="px-8 py-6">Data</th>
                                <th className="px-8 py-6">Operazione</th>
                                <th className="px-8 py-6">Conto</th>
                                <th className="px-8 py-6">Pagato da</th>
                                <th className="px-8 py-6">Beneficiario</th>
                                <th className="px-8 py-6">Categoria</th>
                                <th className="px-8 py-6 text-right">Importo</th>
                                <th className="px-8 py-6"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-8 py-6"><div className="h-4 bg-slate-50 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-700">{format(new Date(tx.date), "dd MMM", { locale: it })}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">{format(new Date(tx.date), "yyyy")}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                                                    {tx.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                                </div>
                                                <span className="text-sm font-black text-slate-800">{tx.description || tx.categories?.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase">
                                                {tx.accounts?.name || "N/A"}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase">
                                                {tx.payer?.name}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase">
                                                {tx.beneficiary?.name || "Famiglia"}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{tx.categories?.name}</span>
                                        </td>
                                        <td className={`px-8 py-6 text-right font-black text-lg ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                            {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                        </td>
                                        <td className="px-8 py-6 text-right opacity-0 group-hover:opacity-100 transition-all">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setTransactionToEdit(tx)}
                                                    className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(tx.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {transactions.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                                                <Filter size={32} />
                                            </div>
                                            <p className="text-slate-400 font-medium italic">Nessuna transazione soddisfa i filtri selezionati.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {(isModalOpen || transactionToEdit) && (
                <AddTransactionModal
                    onClose={() => {
                        setIsModalOpen(false);
                        setTransactionToEdit(null);
                    }}
                    onSuccess={() => {
                        fetchData();
                        setIsModalOpen(false);
                        setTransactionToEdit(null);
                    }}
                    transactionToEdit={transactionToEdit}
                />
            )}
        </div>
    );
}
