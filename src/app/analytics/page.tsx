"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Transaction, MonthlySummary, Category } from "@/lib/types";
import { format, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns";
import { it } from "date-fns/locale";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    PieChart as PieIcon,
    BarChart3,
    Calendar,
    Target,
    ArrowUpRight,
    ArrowDownRight
} from "lucide-react";

// Using dynamic to prevent SSR issues with Recharts
const ResponsiveContainerDynamic = dynamic(() => import("recharts").then(mod => mod.ResponsiveContainer), { ssr: false });

export default function AnalyticsPage() {
    const { member } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<MonthlySummary[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());



    const fetchData = useCallback(async () => {
        if (!member?.family_id) return;
        setIsLoading(true);
        const start = format(startOfYear(new Date(parseInt(selectedYear), 0, 1)), "yyyy-MM-dd");
        const end = format(endOfYear(new Date(parseInt(selectedYear), 11, 31)), "yyyy-MM-dd");

        const { data: txData } = await supabase
            .from("transactions")
            .select("*, categories(name), accounts(id, name, owner_id)")
            .eq("family_id", member.family_id)
            .gte("date", start)
            .lte("date", end);

        const { data: sumData } = await supabase
            .from("monthly_summary")
            .select("*")
            .eq("family_id", member.family_id)
            .like("month", `${selectedYear}-%`);

        const { data: cats } = await supabase
            .from("categories")
            .select("*")
            .eq("family_id", member.family_id);

        if (txData) setTransactions(txData as any);
        if (sumData) setSummary(sumData as any);
        if (cats) setCategories(cats);
        setIsLoading(false);
    }, [selectedYear, member?.family_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- FAMILY BUDGET LOGIC ---
    const familyTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (t.type === 'income') return true;
            if (t.categories?.name?.toLowerCase().includes('giroconto')) return false;

            const isFromJointAccount = t.accounts && t.accounts.owner_id === null;
            const isMealVoucher = t.accounts?.name?.toLowerCase().includes('buoni pasto');

            if (isFromJointAccount || isMealVoucher) return true;
            if (t.beneficiary_id === null) return true; // Famiglia
            if (t.beneficiary_id !== t.payer_id) return true; // Paid for someone else

            return false;
        });
    }, [transactions]);

    // 1. Data per Mese (Bar Chart) - Calculated from familyTransactions
    const monthlyData = useMemo(() => {
        const months = eachMonthOfInterval({
            start: new Date(parseInt(selectedYear), 0, 1),
            end: new Date(parseInt(selectedYear), 11, 31)
        });

        return months.map(m => {
            const mKey = format(m, "yyyy-MM");
            const mLabel = format(m, "MMM", { locale: it });

            const monthTxs = familyTransactions.filter(t => format(new Date(t.date), "yyyy-MM") === mKey);
            const income = monthTxs.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
            const expense = monthTxs.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);

            return {
                name: mLabel,
                income,
                expense,
                balance: income - expense
            };
        });
    }, [familyTransactions, selectedYear]);

    // 2. Data per Categoria (Pie Chart) - Solo Spese
    const categoryData = useMemo(() => {
        const expenses = familyTransactions.filter(t => t.type === 'expense');
        const grouped = expenses.reduce((acc: any, curr) => {
            const catName = curr.categories?.name || "Altro";
            acc[catName] = (acc[catName] || 0) + Number(curr.amount);
            return acc;
        }, {});

        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value: Number(value) }))
            .sort((a, b) => b.value - a.value);
    }, [familyTransactions]);

    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

    const totalYearlyExpense = categoryData.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <div className="space-y-10 animate-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Financial Intelligence</h1>
                    <p className="text-slate-500 font-medium mt-1">Esplora i big data del tuo budget familiare.</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                    {[
                        (new Date().getFullYear() - 1).toString(),
                        new Date().getFullYear().toString(),
                        (new Date().getFullYear() + 1).toString()
                    ].map(year => (
                        <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${selectedYear === year ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            </div>

            {/* Yearly Overview Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 1. Bar Chart: Monthly Comparison */}
                <div className="lg:col-span-2 soft-card">
                    <div className="flex items-center justify-between mb-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                <BarChart3 size={20} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Confronto Entrate vs Uscite</h3>
                        </div>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                    cursor={{ fill: '#f8fafc' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold', color: '#64748b' }} />
                                <Bar dataKey="income" name="Entrate" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                                <Bar dataKey="expense" name="Uscite" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Breakdown: Key Stats & Categories Info */}
                <div className="space-y-8">
                    <div className="soft-card bg-indigo-600 text-white border-transparent">
                        <div className="flex items-center justify-between mb-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Focus Risparmio Annuo</p>
                            <Target size={20} className="opacity-70" />
                        </div>
                        <h2 className="text-4xl font-black tracking-tighter mb-2">€ {monthlyData.reduce((acc, curr) => acc + curr.balance, 0).toLocaleString('it-IT')}</h2>
                        <div className="flex items-center gap-2 text-sm font-bold bg-white/10 w-fit px-3 py-1 rounded-full">
                            <ArrowUpRight size={14} />
                            +18% focus target
                        </div>
                    </div>

                    <div className="soft-card">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                            <PieIcon size={18} className="text-purple-500" />
                            Distribuzione Spese
                        </h3>
                        <div className="space-y-4">
                            {categoryData.slice(0, 5).map((cat, idx) => (
                                <div key={cat.name} className="flex flex-col gap-1.5">
                                    <div className="flex justify-between text-xs font-black">
                                        <span className="text-slate-500">{cat.name}</span>
                                        <span className="text-slate-800">€ {cat.value.toLocaleString('it-IT')}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{
                                                width: `${(cat.value / totalYearlyExpense) * 100}%`,
                                                backgroundColor: COLORS[idx % COLORS.length]
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Lower Grid: Pie Chart & Category Deep Dive */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="soft-card flex flex-col items-center justify-center min-h-[500px]">
                    <h3 className="text-xl font-black text-slate-900 mb-6 self-start w-full">Composizione Portafoglio Uscite</h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={8}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                />
                                <Legend verticalAlign="bottom" align="center" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="soft-card">
                    <h3 className="text-xl font-black text-slate-900 mb-8">Dettaglio Categorie</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {categoryData.map((cat, idx) => (
                            <div key={cat.name} className="p-5 bg-slate-50/50 rounded-2xl border border-slate-50 hover:border-indigo-100/50 hover:bg-white transition-all group">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                                        {cat.name[0]}
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-0.5">
                                        <ArrowDownRight size={10} /> Optimal
                                    </span>
                                </div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{cat.name}</p>
                                <p className="text-lg font-black text-slate-800 mt-1">€ {cat.value.toLocaleString('it-IT')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
