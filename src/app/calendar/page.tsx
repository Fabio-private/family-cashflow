"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Transaction } from "@/lib/types";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    addMonths,
    subMonths,
    isToday,
    getDay,
    startOfWeek,
    endOfWeek
} from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import {
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    Calendar as CalendarIcon,
    Search,
    Filter,
    ArrowUpRight
} from "lucide-react";

import { AddTransactionModal } from "@/components/AddTransactionModal";

export default function CalendarPage() {
    const { member } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalInitialRecurring, setModalInitialRecurring] = useState(false);

    const fetchData = useCallback(async () => {
        if (!member?.family_id) return;
        setIsLoading(true);
        const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
        const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

        const { data } = await supabase
            .from("transactions")
            .select("*, categories(name)")
            .eq("family_id", member.family_id)
            .gte("date", start)
            .lte("date", end);

        if (data) setTransactions(data as any);
        setIsLoading(false);
    }, [currentMonth, member?.family_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const getDailyTransactions = (day: Date) => {
        return transactions.filter(t => isSameDay(new Date(t.date), day));
    };

    const monthlyStats = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
        return { income, expense, balance: income - expense };
    }, [transactions]);

    const peakDay = useMemo(() => {
        const dailyExpenses = transactions.filter(t => t.type === 'expense').reduce((acc: any, curr) => {
            const date = curr.date;
            acc[date] = (acc[date] || 0) + Number(curr.amount);
            return acc;
        }, {});

        const sorted = Object.entries(dailyExpenses).sort((a: any, b: any) => b[1] - a[1]);
        if (sorted.length > 0) {
            return { date: new Date(sorted[0][0]), amount: sorted[0][1] as number };
        }
        return null;
    }, [transactions]);

    return (
        <div className="space-y-10 animate-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Timeline Cronologica</h1>
                    <p className="text-slate-500 font-medium mt-1">Monitora le uscite e le entrate giorno per giorno sul calendario.</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-indigo-600"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="px-4 text-sm font-black text-slate-700 min-w-[150px] text-center uppercase tracking-widest">
                        {format(currentMonth, "MMMM yyyy", { locale: it })}
                    </div>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-indigo-600"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* 1. Main Calendar Grid */}
                <div className="lg:col-span-3 soft-card p-0 overflow-hidden">
                    <div className="grid grid-cols-7 border-b border-slate-50 bg-slate-50/50">
                        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
                            <div key={d} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-50 last:border-r-0">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 grid-rows-5">
                        {days.map((day, i) => {
                            const dailyTx = getDailyTransactions(day);
                            const income = dailyTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
                            const expense = dailyTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
                            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

                            return (
                                <div
                                    key={i}
                                    className={`min-h-[140px] p-3 border-b border-r border-slate-50 last:border-r-0 group transition-all hover:z-10 relative
                                        ${!isCurrentMonth ? 'bg-slate-50/30' : 'bg-white'}
                                        ${isToday(day) ? 'ring-2 ring-indigo-600 ring-inset' : ''}
                                    `}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-xs font-black ${isCurrentMonth ? (isToday(day) ? 'text-indigo-600' : 'text-slate-800') : 'text-slate-200'}`}>
                                            {format(day, "d")}
                                        </span>
                                        {dailyTx.length > 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-md font-black">
                                                {dailyTx.length} ops
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1 mt-auto">
                                        {income > 0 && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black border border-emerald-100/50">
                                                <div className="w-1 h-1 rounded-full bg-emerald-600" />
                                                +€{income.toFixed(0)}
                                            </div>
                                        )}
                                        {expense > 0 && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 text-rose-500 rounded-lg text-[10px] font-black border border-rose-100/50">
                                                <div className="w-1 h-1 rounded-full bg-rose-500" />
                                                -€{expense.toFixed(0)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Hover Details Preview */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/95 backdrop-blur-sm p-4 flex flex-col justify-center gap-2 transition-all pointer-events-none z-20">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{format(day, "dd MMMM", { locale: it })}</p>
                                        <div className="flex justify-between text-xs font-black">
                                            <span className="text-emerald-600">Entrate:</span>
                                            <span className="text-emerald-600">€{income.toLocaleString('it-IT')}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-black">
                                            <span className="text-rose-500">Uscite:</span>
                                            <span className="text-rose-500">€{expense.toLocaleString('it-IT')}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Sidebar: Aggregates & Insights */}
                <div className="space-y-6">
                    <div className="soft-card">
                        <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                            <CalendarIcon size={18} className="text-indigo-600" />
                            Riepilogo Mese
                        </h3>
                        <div className="space-y-6">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Giornata di Picco</p>
                                <p className="text-lg font-black text-slate-800">
                                    {peakDay ? format(peakDay.date, "dd MMMM", { locale: it }) : "Nessuna spesa"}
                                </p>
                                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                                    <ArrowUpRight size={12} /> € {peakDay ? peakDay.amount.toLocaleString('it-IT') : '0'} di spesa
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Bilancio Corrente</p>
                                <p className="text-lg font-black text-slate-800">
                                    {monthlyStats.balance.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                </p>
                                <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-widest ${monthlyStats.balance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {monthlyStats.balance >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    {monthlyStats.balance >= 0 ? 'In attivo' : 'In passivo'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="soft-card bg-indigo-600 text-white">
                        <TrendingUp size={24} className="mb-4 opacity-70" />
                        <h4 className="text-xl font-black mb-2 tracking-tight line-clamp-2">Vuoi aggiungere una spesa ricorrente?</h4>
                        <p className="text-sm font-medium opacity-80 mb-6 leading-relaxed">Configura le spese fisse per vederle automaticamente sul calendario.</p>
                        <button
                            onClick={() => {
                                setModalInitialRecurring(true);
                                setIsModalOpen(true);
                            }}
                            className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/10 active:scale-95 transition-all"
                        >
                            Configura ora
                        </button>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <AddTransactionModal
                    onClose={() => setIsModalOpen(false)}
                    initialIsRecurring={modalInitialRecurring}
                    onSuccess={() => {
                        fetchData();
                        setIsModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}
