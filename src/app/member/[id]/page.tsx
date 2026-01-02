"use client";

import { use, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Transaction, MonthlySummary } from "@/lib/types";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    ArrowLeft,
    Calendar,
    Activity,
    UserCircle,
    Download,
    Share2,
    CheckCircle2
} from "lucide-react";

const DashboardChart = dynamic(() => import("@/components/DashboardChart"), { ssr: false });

export default function MemberPage({ params }: { params: Promise<{ id: string }> }) {
    const { member: currentMember } = useAuth();
    const { id: idParam } = use(params);
    const initialName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam)
        ? "Membro"
        : idParam.charAt(0).toUpperCase() + idParam.slice(1);

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<MonthlySummary[]>([]);
    const [memberName, setMemberName] = useState(initialName);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        if (!currentMember?.family_id) return;

        const currentMonth = format(new Date(), "yyyy-MM");

        // 1. Resolve member from ID or Name
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);
        let query = supabase.from("family_members").select("id, name");

        if (isUuid) {
            query = query.eq("id", idParam);
        } else {
            // Capitalize for legacy name-based URLs
            const capitalizedName = idParam.charAt(0).toUpperCase() + idParam.slice(1);
            query = query.eq("name", capitalizedName);
        }

        const { data: memberObj } = await query.eq("family_id", currentMember.family_id).single();

        if (memberObj) {
            setMemberName(memberObj.name);
            const memberId = memberObj.id;

            // 2. Fetch transactions where member is payer OR beneficiary
            const { data: txData } = await supabase
                .from("transactions")
                .select("*, categories(name), payer:family_members!payer_id(name, id), beneficiary:family_members!beneficiary_id(name, id), accounts(name)")
                .or(`payer_id.eq.${memberId},beneficiary_id.eq.${memberId}`)
                .order("date", { ascending: false });

            // 3. Fetch summary for basic stats
            const { data: sumData } = await supabase
                .from("monthly_summary")
                .select("*")
                .eq("month", currentMonth)
                .eq("member_name", memberObj.name);

            if (txData) setTransactions(txData as any);
            if (sumData) setSummary(sumData as any);
        }

        setIsLoading(false);
    }, [idParam, currentMember?.family_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const stats = useMemo(() => {
        const incomeTxs = transactions.filter(t =>
            t.type === 'income' &&
            !t.categories?.name?.toLowerCase().includes('giroconto') &&
            !t.accounts?.name?.toLowerCase().includes('buoni pasto')
        );
        const expenseTxs = transactions.filter(t => t.type === 'expense');

        const income = incomeTxs.reduce((acc, curr) => acc + Number(curr.amount), 0);
        const expense = expenseTxs.reduce((acc, curr) => acc + Number(curr.amount), 0);

        return { income, expense, balance: income - expense };
    }, [transactions]);

    const chartData = useMemo(() => {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });

        return days.map(day => {
            const dailyTx = transactions.filter(t => isSameDay(new Date(t.date), day));
            const income = dailyTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
            const expense = dailyTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);

            return {
                name: format(day, "ccc", { locale: it }),
                income,
                expense
            };
        });
    }, [transactions]);

    const topCategories = useMemo(() => {
        const expenses = transactions.filter(t => t.type === 'expense');
        const total = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

        const grouped = expenses.reduce((acc: any, curr) => {
            const catName = curr.categories?.name || "Altro";
            acc[catName] = (acc[catName] || 0) + Number(curr.amount);
            return acc;
        }, {});

        return Object.entries(grouped)
            .map(([label, amount]) => ({
                label,
                value: total > 0 ? Math.round((Number(amount) / total) * 100) : 0
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 4);
    }, [transactions]);

    return (
        <div className="space-y-10 animate-up">
            {/* Header: Back & Profile Info */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-start gap-6">
                    <Link href="/" className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">{memberName}</h1>
                            <CheckCircle2 size={24} className="text-indigo-500" />
                        </div>
                        <p className="text-slate-500 font-medium italic">Member Analytics & Expenditure Control</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all shadow-sm">
                        <Download size={16} /> Export
                    </button>
                    <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all shadow-sm">
                        <Share2 size={16} /> Share
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-8">
                <MemberStat label="Uscite Mensili" value={stats.expense} icon={TrendingDown} color="rose" />
                <MemberStat label="Entrate Mensili" value={stats.income} icon={TrendingUp} color="emerald" />
                <MemberStat label="Saldo Disponibile" value={stats.balance} icon={Wallet} color="indigo" />
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-8">
                <div className="xl:col-span-2 soft-card">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                            <Activity size={20} className="text-indigo-500" />
                            Trend di Spesa Personale
                        </h3>
                        <span className="bg-slate-50 text-[10px] font-black text-slate-400 px-3 py-1.5 rounded-lg uppercase tracking-[0.2em]">{format(new Date(), "MMMM yyyy", { locale: it })}</span>
                    </div>
                    <DashboardChart data={chartData} />
                </div>

                <div className="soft-card flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 mb-8 underline decoration-indigo-200 decoration-4 underline-offset-4">Top Categories</h3>
                        <div className="space-y-8">
                            {topCategories.length > 0 ? (
                                topCategories.map((cat, idx) => (
                                    <CategoryRow
                                        key={cat.label}
                                        label={cat.label}
                                        value={cat.value}
                                        color={['bg-rose-500', 'bg-indigo-600', 'bg-emerald-500', 'bg-amber-400', 'bg-slate-400'][idx % 5]}
                                    />
                                ))
                            ) : (
                                <p className="text-sm font-bold text-slate-400 italic">Nessuna spesa registrata questo mese.</p>
                            )}
                        </div>
                    </div>
                    <div className="mt-10 p-5 bg-indigo-50 rounded-[1.5rem] border border-indigo-100/50">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Financial Tip</p>
                        <p className="text-xs font-bold text-indigo-700 leading-relaxed">Consider reduction in "Leisure" to boost monthly savings by 5%.</p>
                    </div>
                </div>
            </div>

            {/* Transaction Log */}
            <div className="soft-card p-0">
                <div className="p-8 border-b border-slate-50">
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter">Detailed Logs</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                                <th className="px-6 md:px-8 py-5">Dettaglio</th>
                                <th className="px-6 md:px-8 py-5 hidden sm:table-cell">Pagato da</th>
                                <th className="px-6 md:px-8 py-5 hidden md:table-cell">Beneficiario</th>
                                <th className="px-6 md:px-8 py-5 hidden lg:table-cell">Categoria</th>
                                <th className="px-6 md:px-8 py-5 hidden sm:table-cell text-[11px] font-bold">Data</th>
                                <th className="px-6 md:px-8 py-5 text-right">Valore</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="group hover:bg-slate-50/30 transition-colors">
                                    <td className="px-6 md:px-8 py-5 font-black text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{tx.description || tx.categories?.name}</td>
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
                                    <td className="px-6 md:px-8 py-5 hidden lg:table-cell">
                                        <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-3 py-1.5 rounded-lg uppercase">
                                            {tx.categories?.name}
                                        </span>
                                    </td>
                                    <td className="px-6 md:px-8 py-5 hidden sm:table-cell text-[11px] font-bold text-slate-300">
                                        {format(new Date(tx.date), "dd MMM yyyy", { locale: it })}
                                    </td>
                                    <td className={`px-6 md:px-8 py-5 text-right font-black text-lg ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                        {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function MemberStat({ label, value, icon: Icon, color }: any) {
    const colors: any = {
        rose: "text-rose-600",
        emerald: "text-emerald-600",
        indigo: "text-indigo-600"
    };
    return (
        <div className="soft-card p-8 border-b-8 border-slate-50 hover:border-indigo-100 transition-all">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</p>
                    <Icon size={20} className={colors[color]} />
                </div>
                <p className={`text-4xl font-black tracking-tighter ${colors[color]}`}>
                    {value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                </p>
            </div>
        </div>
    );
}

function CategoryRow({ label, value, color }: any) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>{label}</span>
                <span>{value}%</span>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
            </div>
        </div>
    );
}
