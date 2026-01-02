"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { Transaction, MonthlySummary } from "../lib/types";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Plus,
    Users,
    Activity,
    ArrowUpRight,
    Search,
    Filter,
    ArrowRight,
    PlusCircle,
    User,
    Tag,
    FileText
} from "lucide-react";
import { AddTransactionModal } from "./AddTransactionModal";

const DashboardChart = dynamic(() => import("./DashboardChart"), { ssr: false });

function BudgetProgressCard({ budgetGoal, expense }: { budgetGoal: number, expense: number }) {
    const percent = budgetGoal > 0 ? Math.min((expense / budgetGoal) * 100, 100) : 0;
    const remaining = budgetGoal - expense;
    const isOver = remaining < 0;

    return (
        <div className="soft-card bg-white p-6 border-none flex flex-col justify-between group overflow-hidden relative">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget Disponibile</p>
                    <h3 className="text-xl font-black text-slate-900">€{budgetGoal.toLocaleString('it-IT')}</h3>
                </div>
                <div className={`p-2 rounded-lg ${isOver ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>
                    <Activity size={18} />
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-end">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {isOver ? 'Budget Superato!' : 'Rimanente'}
                    </p>
                    <p className={`text-sm font-black ${isOver ? 'text-rose-500' : 'text-slate-900'}`}>
                        €{Math.abs(remaining).toLocaleString('it-IT')}
                    </p>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ease-out rounded-full ${isOver ? 'bg-rose-500' : 'bg-indigo-500'}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <p className="text-[10px] font-bold text-slate-400">
                    Hai utilizzato il <span className={isOver ? 'text-rose-500' : 'text-indigo-500'}>{percent.toFixed(0)}%</span> del budget prefissato.
                </p>
            </div>

            {/* Background design element */}
            <div className="absolute -bottom-6 -right-6 text-slate-50 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <TrendingDown size={120} />
            </div>
        </div>
    );
}

function BuoniPastoCard({ balance }: { balance: number }) {
    return (
        <div className="soft-card bg-emerald-500 p-6 border-none flex flex-col justify-between group overflow-hidden relative text-white">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">Residuo Buoni Pasto</p>
                    <h3 className="text-xl font-black">€{balance.toLocaleString('it-IT')}</h3>
                </div>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                    <TrendingUp size={18} />
                </div>
            </div>

            <div className="space-y-1">
                <p className="text-[10px] font-bold text-emerald-100 italic">"Galoppa la spesa!"</p>
                <div className="h-1.5 w-full bg-emerald-700/30 rounded-full overflow-hidden mt-2">
                    <div
                        className="h-full bg-white rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min((balance / 200) * 100, 100)}%` }}
                    />
                </div>
            </div>

            <div className="absolute -bottom-6 -right-6 text-white opacity-10 group-hover:scale-110 transition-transform duration-500">
                <PlusCircle size={120} />
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { member } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [summary, setSummary] = useState<MonthlySummary[]>([]);
    const [prevSummary, setPrevSummary] = useState<MonthlySummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);

    const fetchData = useCallback(async () => {
        if (!member?.family_id) return;

        setIsLoading(true);
        const now = new Date();
        const currentMonth = format(now, "yyyy-MM");
        const prevMonth = format(subMonths(now, 1), "yyyy-MM");

        const { data: txData } = await supabase
            .from("transactions")
            .select("*, categories(name, id), payer:family_members!payer_id(name, id), beneficiary:family_members!beneficiary_id(name, id), accounts(id, name, owner_id)")
            .eq("family_id", member.family_id)
            .order("date", { ascending: false });

        const { data: sumData } = await supabase
            .from("monthly_summary")
            .select("*")
            .eq("month", currentMonth)
            .eq("family_id", member.family_id);

        const { data: prevSumData } = await supabase
            .from("monthly_summary")
            .select("*")
            .eq("month", prevMonth)
            .eq("family_id", member.family_id);

        const { data: mData } = await supabase
            .from("family_members")
            .select("*")
            .eq("family_id", member.family_id);

        const { data: catData } = await supabase
            .from("categories")
            .select("*")
            .eq("family_id", member.family_id)
            .order("name");

        const { data: acctData } = await supabase
            .from("accounts")
            .select("*")
            .eq("family_id", member.family_id);

        if (txData) setTransactions(txData as any);
        if (sumData) setSummary(sumData as any);
        if (prevSumData) setPrevSummary(prevSumData as any);
        if (mData) setMembers(mData);
        if (catData) setCategories(catData);
        if (acctData) setAccounts(acctData);
        setIsLoading(false);
    }, [member?.family_id]);

    const processFixedItems = useCallback(async (currentTxs: Transaction[], allCategories: any[]) => {
        if (!member?.family_id) return;

        const { data: fixedItems } = await supabase
            .from("fixed_items")
            .select("*")
            .eq("active", true)
            .eq("family_id", member.family_id);

        if (!fixedItems || fixedItems.length === 0) return;

        const now = new Date();
        const currentMonthStr = format(now, "yyyy-MM");

        const newTransactions = [];

        for (const item of fixedItems) {
            // Check if already exists in current month
            const alreadyExists = currentTxs.some(t =>
                t.description === item.description &&
                Number(t.amount) === Number(item.amount) &&
                t.payer_id === item.payer_id &&
                format(new Date(t.date), "yyyy-MM") === currentMonthStr
            );

            if (!alreadyExists) {
                // Determine anchor day from next_generation_date if available, otherwise from created_at
                const anchorDate = item.next_generation_date ? new Date(item.next_generation_date) : new Date(item.created_at);
                const anchorDay = anchorDate.getDate();

                const targetDate = new Date(now.getFullYear(), now.getMonth(), anchorDay);
                // Ensure we don't pick a day that doesn't exist (e.g. 31st of Feb)
                const finalDate = targetDate.getMonth() !== now.getMonth()
                    ? new Date(now.getFullYear(), now.getMonth() + 1, 0) // last day of current month
                    : targetDate;

                newTransactions.push({
                    amount: item.amount,
                    description: item.description,
                    type: item.type,
                    category_id: item.category_id,
                    payer_id: item.payer_id,
                    beneficiary_id: item.beneficiary_id,
                    account_id: item.account_id,
                    family_id: member.family_id,
                    date: format(finalDate, "yyyy-MM-dd")
                });
            }
        }

        if (newTransactions.length > 0) {
            const { error } = await supabase.from("transactions").insert(newTransactions);
            if (!error) {
                // Refresh data to show new transactions
                fetchData();
            }
        }
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Run processing after initial fetch
    useEffect(() => {
        if (!isLoading && transactions.length > 0 && categories.length > 0) {
            processFixedItems(transactions, categories);
        }
    }, [isLoading, transactions.length, categories.length, processFixedItems]);

    const stats = useMemo(() => {
        const validTxs = transactions.filter(t => !t.categories?.name?.toLowerCase().includes('giroconto'));

        const income = validTxs
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Number(t.amount), 0);
        const expense = validTxs
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const prevIncome = prevSummary.filter(s => s.type === 'income').reduce((acc, curr) => acc + Number(curr.total_amount), 0);
        const prevExpense = prevSummary.filter(s => s.type === 'expense').reduce((acc, curr) => acc + Number(curr.total_amount), 0);

        const calculateTrend = (curr: number, prev: number) => {
            if (prev === 0) return 0;
            return ((curr - prev) / prev) * 100;
        };

        return {
            income,
            expense,
            balance: income - expense,
            incomeTrend: calculateTrend(income, prevIncome),
            expenseTrend: calculateTrend(expense, prevExpense),
            balanceTrend: calculateTrend(income - expense, prevIncome - prevExpense)
        };
    }, [summary, prevSummary, transactions]);

    const buoniPastoBalance = useMemo(() => {
        const bpAccountNames = ["Buoni Pasto Fabio", "Buoni pasto Fabio"];
        const bpIncome = transactions
            .filter(t => t.type === 'income' && bpAccountNames.includes(t.accounts?.name || ""))
            .reduce((acc, curr) => acc + Number(curr.amount), 0);

        const validTxs = transactions.filter(t => !t.categories?.name?.toLowerCase().includes('giroconto'));

        const bpExpense = validTxs
            .filter(t => t.type === 'expense' && bpAccountNames.includes(t.accounts?.name || ""))
            .reduce((acc, curr) => acc + Number(curr.amount), 0);
        return bpIncome - bpExpense;
    }, [transactions]);

    const dynamicBudget = useMemo(() => {
        const now = new Date();
        const currentMonthTransactions = transactions.filter(t =>
            format(new Date(t.date), "yyyy-MM") === format(now, "yyyy-MM")
        );

        const incomeSources = [
            "Fideuram Cointestato",
            "Fideuram condiviso",
            "Buoni Pasto Fabio",
            "Buoni pasto Fabio"
        ];
        const incomeFromSources = currentMonthTransactions
            .filter(t => t.type === 'income' && incomeSources.includes(t.accounts?.name || ""))
            .reduce((acc, curr) => acc + Number(curr.amount), 0);

        const incomeFromBonus = currentMonthTransactions
            .filter(t => t.type === 'income' && (
                t.description?.toLowerCase().includes("bonus") ||
                t.categories?.name?.toLowerCase().includes("bonus")
            ))
            .reduce((acc, curr) => acc + Number(curr.amount), 0);

        return incomeFromSources + incomeFromBonus;
    }, [transactions]);

    const chartData = useMemo(() => {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });

        const validTxs = transactions.filter(t => !t.categories?.name?.toLowerCase().includes('giroconto'));

        return days.map(day => {
            const dailyTx = validTxs.filter(t => isSameDay(new Date(t.date), day));
            const income = dailyTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
            const expense = dailyTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);

            return {
                name: format(day, "ccc", { locale: it }),
                income,
                expense
            };
        });
    }, [transactions]);

    const currentMonthLabel = useMemo(() => {
        return format(new Date(), "MMMM yyyy", { locale: it });
    }, []);

    const filteredTransactions = useMemo(() => {
        if (!searchTerm) return transactions.slice(0, 10);
        const lowerTerm = searchTerm.toLowerCase();
        return transactions.filter(tx =>
            (tx.description?.toLowerCase().includes(lowerTerm)) ||
            (tx.categories?.name?.toLowerCase().includes(lowerTerm)) ||
            (tx.payer?.name?.toLowerCase().includes(lowerTerm)) ||
            (tx.beneficiary?.name?.toLowerCase().includes(lowerTerm))
        ).slice(0, 20);
    }, [transactions, searchTerm]);

    const suggestions = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        const lowerTerm = searchTerm.toLowerCase();

        const memberSugs = members
            .filter(m => m.name.toLowerCase().includes(lowerTerm))
            .map(m => ({ type: 'member', label: m.name, id: m.id }));

        const catSugs = Array.from(new Set(transactions.map(tx => tx.categories?.name)))
            .filter(name => name?.toLowerCase().includes(lowerTerm))
            .map(name => ({ type: 'category', label: name, id: name }));

        const descSugs = Array.from(new Set(transactions.map(tx => tx.description)))
            .filter(desc => desc?.toLowerCase().includes(lowerTerm))
            .map(desc => ({ type: 'description', label: desc, id: desc }));

        return [...memberSugs, ...catSugs, ...descSugs].slice(0, 6);
    }, [searchTerm, members, transactions]);

    // --- REBALANCE CALCULATION ---
    const rebalanceData = useMemo(() => {
        const fabio = members.find(m => m.name?.trim().toLowerCase() === 'fabio');
        const giulia = members.find(m => m.name?.trim().toLowerCase() === 'giulia');

        if (!fabio || !giulia || transactions.length === 0) return null;

        const now = new Date();
        const currentMonthExpenses = transactions.filter(t => {
            const tDate = new Date(t.date);
            const isFromJointAccount = t.accounts && t.accounts.owner_id === null;
            return t.type === 'expense' &&
                tDate.getMonth() === now.getMonth() &&
                tDate.getFullYear() === now.getFullYear() &&
                !isFromJointAccount;
        });

        const commonExpenses = currentMonthExpenses.filter(t => !t.beneficiary_id);
        const fabioPaidCommon = commonExpenses.filter(t => t.payer_id === fabio.id).reduce((acc, t) => acc + Number(t.amount), 0);
        const giuliaPaidCommon = commonExpenses.filter(t => t.payer_id === giulia.id).reduce((acc, t) => acc + Number(t.amount), 0);

        const fabioPaidForGiulia = currentMonthExpenses.filter(t => t.payer_id === fabio.id && t.beneficiary_id === giulia.id).reduce((acc, t) => acc + Number(t.amount), 0);
        const giuliaPaidForFabio = currentMonthExpenses.filter(t => t.payer_id === giulia.id && t.beneficiary_id === fabio.id).reduce((acc, t) => acc + Number(t.amount), 0);

        const fabioCredit = (fabioPaidCommon / 2) + fabioPaidForGiulia;
        const giuliaCredit = (giuliaPaidCommon / 2) + giuliaPaidForFabio;
        const netBalance = fabioCredit - giuliaCredit;

        return {
            fabio,
            giulia,
            netBalance,
            totalActivity: fabioPaidCommon + giuliaPaidCommon + fabioPaidForGiulia + giuliaPaidForFabio
        };
    }, [transactions, members]);

    const contributionStatus = useMemo(() => {
        const now = new Date();
        const currentMonthTxs = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const fideuramNames = ["Fideuram Cointestato", "Fideuram condiviso"];
        const fabio = members.find(m => m.name.trim().toLowerCase() === 'fabio');
        const giulia = members.find(m => m.name.trim().toLowerCase() === 'giulia');

        const fabioPushed = currentMonthTxs.some(t =>
            t.type === 'income' &&
            fideuramNames.includes(t.accounts?.name || "") &&
            t.payer_id === fabio?.id &&
            Number(t.amount) >= 600
        );

        const giuliaPushed = currentMonthTxs.some(t =>
            t.type === 'income' &&
            fideuramNames.includes(t.accounts?.name || "") &&
            t.payer_id === giulia?.id &&
            Number(t.amount) >= 600
        );

        return { fabio: fabioPushed, giulia: giuliaPushed };
    }, [transactions, members]);

    const handleSettlement = async () => {
        if (!rebalanceData || rebalanceData.netBalance === 0) return;

        try {
            const now = new Date();
            const debtor = rebalanceData.netBalance > 0 ? rebalanceData.giulia : rebalanceData.fabio;
            const creditor = rebalanceData.netBalance > 0 ? rebalanceData.fabio : rebalanceData.giulia;
            const amount = Math.abs(rebalanceData.netBalance);
            const settlementCat = categories.find(c => c.name.trim().toLowerCase() === 'altro') || categories[0];

            const { error } = await supabase.from('transactions').insert({
                payer_id: debtor.id,
                beneficiary_id: creditor.id,
                amount: amount,
                description: `Pareggio Spese - ${format(now, 'MMMM yyyy', { locale: it })}`,
                type: 'expense',
                category_id: settlementCat?.id,
                date: new Date().toISOString().split('T')[0]
            });

            if (error) throw error;
            fetchData();
        } catch (err) {
            console.error("Errore pareggio:", err);
        }
    };

    const handleRecordContribution = async (memberName: string) => {
        const member = members.find(m => m.name.trim().toLowerCase() === memberName.toLowerCase());
        if (!member) return;

        const fideuramNames = ["Fideuram Cointestato", "Fideuram condiviso"];
        const sharedAccount = accounts.find((a: any) => fideuramNames.includes(a.name));
        const personalAccount = accounts.find((a: any) => a.owner_id === member.id);

        // Find categories by name mapping from migration
        const catExpense = categories.find((c: any) => c.name.includes('Giroconto') && c.type === 'expense');
        const catIncome = categories.find((c: any) => c.name.includes('Giroconto') && c.type === 'income');

        const expenseCatId = catExpense?.id;
        const incomeCatId = catIncome?.id;

        if (!sharedAccount || !personalAccount || !expenseCatId || !incomeCatId) {
            alert("Errore: Configurazione incompleta. Assicurati di aver eseguito lo script SQL 'migration_giroconto.sql' e di aver configurato i conti.");
            return;
        }

        try {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];

            const transactionsToInsert = [
                {
                    amount: 600,
                    description: 'Quota Mensile Fideuram (Automatico)',
                    type: 'expense',
                    category_id: expenseCatId,
                    payer_id: member.id,
                    account_id: personalAccount.id,
                    date: dateStr
                },
                {
                    amount: 600,
                    description: 'Quota Mensile Fideuram (Automatico)',
                    type: 'income',
                    category_id: incomeCatId,
                    payer_id: member.id,
                    beneficiary_id: null,
                    account_id: sharedAccount.id,
                    date: dateStr
                }
            ];

            const { error } = await supabase.from('transactions').insert(transactionsToInsert);
            if (error) throw error;

            fetchData();
        } catch (err: any) {
            console.error("Errore registrazione quota:", err);
            alert("Errore nella registrazione: " + err.message);
        }
    };

    return (
        <div className="space-y-12 animate-up">
            {/* 1. Welcome Hero Section - Ultra Compact */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-stretch">
                {/* Brand & Action Column */}
                <div className="lg:col-span-1 soft-card bg-white p-8 border-none flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none relative z-10">Famiglia Cashflow</h1>
                    <p className="text-slate-400 text-[10px] font-black mt-3 flex items-center gap-1.5 uppercase tracking-widest relative z-10">
                        <Activity size={12} className="text-indigo-500" />
                        {currentMonthLabel}
                    </p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="mt-8 w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-200 transition-all active:scale-95 relative z-10"
                    >
                        <PlusCircle size={18} /> Nuova Operazione
                    </button>
                </div>

                {/* Resources Stack Column */}
                <div className="lg:col-span-1">
                    <BudgetProgressCard budgetGoal={dynamicBudget} expense={stats.expense} />
                </div>

                <div className="lg:col-span-1 flex flex-col gap-4">
                    <BuoniPastoCard balance={buoniPastoBalance} />
                    <div className="soft-card p-4 flex items-center justify-between bg-white border-slate-100">
                        <div className="flex gap-2">
                            <button
                                onClick={() => !contributionStatus.fabio && handleRecordContribution('Fabio')}
                                disabled={contributionStatus.fabio}
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all shadow-sm relative group overflow-hidden ${contributionStatus.fabio
                                    ? 'bg-emerald-500 text-white shadow-emerald-200'
                                    : 'bg-white text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-slate-100'
                                    }`}
                                title={contributionStatus.fabio ? 'Quota versata' : 'Registra quota Fabio (600€)'}
                            >
                                <span className="relative z-10">F</span>
                                {!contributionStatus.fabio && (
                                    <div className="absolute inset-0 bg-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Plus size={12} className="text-indigo-600 ml-3 mt-3" />
                                    </div>
                                )}
                            </button>
                            <button
                                onClick={() => !contributionStatus.giulia && handleRecordContribution('Giulia')}
                                disabled={contributionStatus.giulia}
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all shadow-sm relative group overflow-hidden ${contributionStatus.giulia
                                    ? 'bg-emerald-500 text-white shadow-emerald-200'
                                    : 'bg-white text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-slate-100'
                                    }`}
                                title={contributionStatus.giulia ? 'Quota versata' : 'Registra quota Giulia (600€)'}
                            >
                                <span className="relative z-10">G</span>
                                {!contributionStatus.giulia && (
                                    <div className="absolute inset-0 bg-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Plus size={12} className="text-indigo-600 ml-3 mt-3" />
                                    </div>
                                )}
                            </button>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quota 600€</span>
                    </div>
                </div>
            </div>
            {/* 2. Primary Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                <MetricCard
                    label="Entrate Totali"
                    value={stats.income}
                    icon={TrendingUp}
                    color="emerald"
                    trend={`${stats.incomeTrend > 0 ? '+' : ''}${stats.incomeTrend.toFixed(0)}% vs mese scorso`}
                />
                <MetricCard
                    label="Spese Totali"
                    value={stats.expense}
                    icon={TrendingDown}
                    color="rose"
                    trend={`${stats.expenseTrend > 0 ? '+' : ''}${stats.expenseTrend.toFixed(0)}% vs mese scorso`}
                />
                <MetricCard
                    label="Bilancio Netto"
                    value={stats.income - stats.expense}
                    icon={TrendingUp}
                    color="indigo"
                    trend={stats.income - stats.expense > 0 ? "In Attivo" : "In Passivo"}
                />
                <RebalanceMetricCard data={rebalanceData} onSettle={handleSettlement} />
            </div>
            {/* 3. Analysis & Feed Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-8">
                {/* 3a. Main Analytics Card */}
                <div className="xl:col-span-2 soft-card p-4 md:p-8">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Andamento Settimanale</h3>
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Ultimi 7 giorni</p>
                        </div>
                        <div className="flex gap-2">
                            <button className="p-2 border border-slate-100 rounded-xl text-slate-400 hover:text-slate-600"><Filter size={18} /></button>
                            <button className="p-2 border border-slate-100 rounded-xl text-slate-400 hover:text-slate-600 text-sm font-bold px-4">Questa Settimana</button>
                        </div>
                    </div>
                    <DashboardChart data={chartData} />
                </div>

                {/* 3b. Members Overview */}
                <div className="soft-card">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-slate-900">Per Membro (Uscite)</h3>
                        <Link href="/members" className="text-indigo-600 font-bold text-xs flex items-center gap-1 hover:gap-2 transition-all">
                            Tutti <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="space-y-6">
                        {summary.filter(s => s.type === 'expense').map((m, idx) => (
                            <Link
                                key={idx}
                                href={`/member/${m.member_name.toLowerCase()}`}
                                className="flex items-center justify-between group p-3 -mx-3 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-100 to-white flex items-center justify-center font-black text-slate-400 border border-slate-200 group-hover:from-indigo-600 group-hover:to-violet-500 group-hover:text-white group-hover:border-transparent transition-all shadow-sm">
                                        {m.member_name[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{m.member_name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Spesa: € {Number(m.total_amount).toFixed(2)}</p>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                    <ArrowUpRight size={14} className="text-slate-400" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. Transactions List */}
            <div className="soft-card p-0 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Ultime Operazioni</h3>
                        <p className="text-sm text-slate-400 font-medium">Cronologia in tempo reale delle attività di famiglia.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                            <input
                                type="text"
                                placeholder="Cerca..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                onFocus={() => setShowSuggestions(true)}
                                className="bg-slate-50 rounded-xl py-2 pl-9 pr-4 text-xs font-bold border-none outline-none w-full md:w-64 focus:ring-2 focus:ring-indigo-100 transition-all"
                            />

                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full right-0 mt-2 w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                                    {suggestions.map((sug, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                if (sug.type === 'member') {
                                                    window.location.href = `/member/${sug.label.toLowerCase()}`;
                                                } else {
                                                    setSearchTerm(sug.label);
                                                }
                                                setShowSuggestions(false);
                                            }}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-all text-left group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                                {sug.type === 'member' ? <User size={14} /> : sug.type === 'category' ? <Tag size={14} /> : <Search size={14} />}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-slate-800">{sug.label}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{sug.type === 'member' ? 'Profilo Membro' : sug.type === 'category' ? 'Categoria' : 'Descrizione'}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">
                                <th className="px-6 md:px-8 py-5">Dettaglio</th>
                                <th className="px-6 md:px-8 py-5 hidden sm:table-cell">Pagato da</th>
                                <th className="px-6 md:px-8 py-5 hidden md:table-cell">Beneficiario</th>
                                <th className="px-6 md:px-8 py-5 text-right">Valore</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50/50">
                            {filteredTransactions.map((tx) => (
                                <tr key={tx.id} className="group hover:bg-slate-50/40 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 border-white shadow-sm ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                                                {tx.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm">{tx.description || tx.categories?.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(new Date(tx.date), "dd MMM", { locale: it })}</p>
                                                    <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-black uppercase">{tx.categories?.name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 md:px-8 py-5 hidden sm:table-cell">
                                        <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-3 py-1.5 rounded-lg uppercase">
                                            {tx.payer?.name}
                                        </span>
                                    </td>
                                    <td className="px-6 md:px-8 py-5 hidden md:table-cell">
                                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-400 px-3 py-1.5 rounded-lg uppercase">
                                            {tx.beneficiary?.name || "Famiglia"}
                                        </span>
                                    </td>
                                    <td className={`px-6 md:px-8 py-5 text-right font-black text-lg ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                        {tx.type === 'income' ? '+' : '-'}{Math.abs(Number(tx.amount)).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <AddTransactionModal
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        fetchData();
                        setIsModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}

function MetricCard({ label, value, icon: Icon, color, trend, isNumber = false }: any) {
    const colors: any = {
        emerald: "bg-emerald-50 text-emerald-600 shadow-emerald-50",
        rose: "bg-rose-50 text-rose-500 shadow-rose-50",
        indigo: "bg-indigo-50 text-indigo-600 shadow-indigo-50",
        violet: "bg-violet-50 text-violet-600 shadow-violet-50"
    };

    return (
        <div className="soft-card p-8 flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:rotate-6 shadow-md ${colors[color]}`}>
                    <Icon size={26} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">{trend}</span>
                </div>
            </div>
            <div>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">
                    {isNumber ? value : value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                </p>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">{label}</p>
            </div>
        </div>
    );
}

function RebalanceMetricCard({ data, onSettle }: { data: any, onSettle: () => void }) {
    const isZero = !data || data.netBalance === 0;

    return (
        <div className="soft-card p-8 flex flex-col justify-between group relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:rotate-6 shadow-md ${isZero ? 'bg-slate-50 text-slate-400' : 'bg-violet-50 text-violet-600 shadow-violet-50'}`}>
                    <ArrowUpRight size={26} strokeWidth={2.5} />
                </div>
                {!isZero && (
                    <button
                        onClick={onSettle}
                        className="text-[10px] font-black text-violet-600 uppercase tracking-widest bg-violet-100/50 px-3 py-1.5 rounded-lg hover:bg-violet-600 hover:text-white transition-all active:scale-95"
                    >
                        Pareggia Ora
                    </button>
                )}
            </div>
            <div>
                <p className="text-xl font-black text-slate-900 tracking-tighter leading-tight">
                    {isZero ? (
                        "Tutto in pari!"
                    ) : (
                        data.netBalance > 0
                            ? `${data.giulia.name} deve ${Math.abs(data.netBalance).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} a ${data.fabio.name}`
                            : `${data.fabio.name} deve ${Math.abs(data.netBalance).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} a ${data.giulia.name}`
                    )}
                </p>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Ribilanciamento Spese</p>
            </div>
        </div>
    );
}
