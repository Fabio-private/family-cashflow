"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { Transaction, MonthlySummary } from "../lib/types";
import { isJointContribution } from "../lib/incomeClassification";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subMonths, addMonths, endOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import {
    ChevronLeft,
    ChevronRight,
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
    FileText,
    BarChart3,
    UtensilsCrossed,
    Receipt
} from "lucide-react";
import { AddTransactionModal } from "./AddTransactionModal";

const DashboardChart = dynamic(() => import("./DashboardChart"), { ssr: false });
const CategoryPieChart = dynamic(() => import("./CategoryPieChart"), { ssr: false });


export default function Dashboard() {
    const { member } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
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
    const [isSubmittingQuota, setIsSubmittingQuota] = useState(false);

    // --- FAMILY BUDGET LOGIC ---
    // Spese di gruppo: gravano sul budget famiglia. Escludono prestiti adulto↔adulto e pareggi.
    const groupExpenses = useMemo(() => {
        const childOrPetIds = members.filter(m => ['child', 'pet'].includes(m.role)).map(m => m.id);
        return transactions.filter(t => {
            if (t.type !== 'expense') return false;
            if (t.categories?.name?.toLowerCase().includes('giroconto')) return false;
            if (t.description?.toLowerCase().startsWith('pareggio spese')) return false;

            const isJointAccount = t.accounts && t.accounts.owner_id === null;
            const isMealVoucher = t.accounts?.name?.toLowerCase().includes('buoni pasto');
            if (isJointAccount || isMealVoucher) return true;

            if (t.beneficiary_id === null) return true;
            if (childOrPetIds.includes(t.beneficiary_id)) return true;
            return false;
        });
    }, [transactions, members]);

    // Prestiti incrociati tra adulti (es. Fabio paga per Giulia da conto suo) + righe di pareggio:
    // entrano nel rebalancing per spostare denaro tra adulti, ma sono escluse da groupExpenses
    // (pie chart, totali famiglia) perché non sono spese di gruppo.
    const crossLoans = useMemo(() => {
        const adultIds = members.filter(m => m.role === 'parent').map(m => m.id);
        return transactions.filter(t => {
            if (t.type !== 'expense') return false;
            if (t.categories?.name?.toLowerCase().includes('giroconto')) return false;
            if (!t.beneficiary_id || t.payer_id === t.beneficiary_id) return false;
            if (!adultIds.includes(t.payer_id) || !adultIds.includes(t.beneficiary_id)) return false;
            const isJointAccount = t.accounts && t.accounts.owner_id === null;
            const isMealVoucher = t.accounts?.name?.toLowerCase().includes('buoni pasto');
            if (isJointAccount || isMealVoucher) return false;
            return true;
        });
    }, [transactions, members]);

    // Entrate su conti joint o buoni pasto (per dynamicBudget e rebalanceData.contributions).
    const jointIncome = useMemo(() => {
        return transactions.filter(t => {
            if (t.type !== 'income') return false;
            const isJointAccount = t.accounts && t.accounts.owner_id === null;
            const isMealVoucher = t.accounts?.name?.toLowerCase().includes('buoni pasto');
            return isJointAccount || isMealVoucher;
        });
    }, [transactions]);

    const fetchData = useCallback(async () => {
        if (!member?.family_id) return;

        setIsLoading(true);
        const currentMonth = format(selectedMonth, "yyyy-MM");
        const prevMonth = format(subMonths(selectedMonth, 1), "yyyy-MM");

        const txQuery = supabase
            .from("transactions")
            .select("*, categories(name, id), payer:family_members!payer_id(name, id), beneficiary:family_members!beneficiary_id(name, id), accounts(id, name, owner_id)")
            .eq("family_id", member.family_id)
            .order("date", { ascending: false });

        const { data: txData, error: txError } = await txQuery;
        if (txError) console.error("Error fetching transactions:", txError);

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
    }, [member?.family_id, selectedMonth]);

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
        const currentMonthStr = format(selectedMonth, "yyyy-MM");
        const prevMonthStr = format(subMonths(selectedMonth, 1), "yyyy-MM");

        // Get children IDs (Federico, Ludovica, Dante)
        const childrenIds = members.filter(m => ['child', 'pet'].includes(m.role)).map(m => m.id);

        // Helper: check if expense is for family (null) or children
        const isFamilyOrChildExpense = (t: Transaction) => {
            if (t.type !== 'expense') return false;
            if (t.categories?.name?.toLowerCase().includes('giroconto')) return false;
            // Famiglia (null) or for a child
            return t.beneficiary_id === null || childrenIds.includes(t.beneficiary_id);
        };

        // BUG-9: cointestato = SOLO owner_id === null
        const isFromJoint = (t: Transaction) => t.accounts?.owner_id === null;

        const currentTxs = transactions.filter(t => format(new Date(t.date), "yyyy-MM") === currentMonthStr);
        const prevTxs = transactions.filter(t => format(new Date(t.date), "yyyy-MM") === prevMonthStr);

        // Budget Disponibile = Incomes to Joint accounts (EXCLUDING Meal Vouchers)
        const income = currentTxs
            .filter(t => t.type === 'income' && isFromJoint(t) && !t.accounts?.name?.toLowerCase().includes('buoni pasto'))
            .reduce((sum, t) => sum + Number(t.amount), 0);

        // Spese Totali (Famiglia) = Only from joint account, for Famiglia or children
        const expense = currentTxs
            .filter(t => isFamilyOrChildExpense(t) && isFromJoint(t))
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const prevIncome = prevTxs
            .filter(t => t.type === 'income' && isFromJoint(t) && !t.accounts?.name?.toLowerCase().includes('buoni pasto'))
            .reduce((sum, t) => sum + Number(t.amount), 0);
        const prevExpense = prevTxs
            .filter(t => isFamilyOrChildExpense(t) && isFromJoint(t))
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const calculateTrend = (curr: number, prev: number) => {
            if (prev === 0) return 0;
            return ((curr - prev) / prev) * 100;
        };

        return {
            income, // This is "Budget Disponibile"
            expense, // This is "Spese Totali (Famiglia)" - only joint account
            balance: income - expense, // This is "Bilancio Netto"
            incomeTrend: calculateTrend(income, prevIncome),
            expenseTrend: calculateTrend(expense, prevExpense),
            balanceTrend: calculateTrend(income - expense, prevIncome - prevExpense)
        };
    }, [transactions, members, selectedMonth]);

    // Spese Totali Effettive: TUTTE le spese per la famiglia da TUTTI i conti
    // Include spese da conto cointestato E da conti personali per famiglia/figli
    const effectiveTotalExpenses = useMemo(() => {
        const currentMonthStr = format(selectedMonth, "yyyy-MM");
        const prevMonthStr = format(subMonths(selectedMonth, 1), "yyyy-MM");

        // Get children IDs
        const childrenIds = members.filter(m => ['child', 'pet'].includes(m.role)).map(m => m.id);

        // Filtro per tutte le spese "per la famiglia" da qualsiasi conto:
        // 1. Spese con beneficiario null (Famiglia)
        // 2. Spese per figli (Federico, Ludovica, Dante)
        // Escluso: giroconti
        const allFamilyExpenses = transactions.filter(t => {
            if (t.type !== 'expense') return false;
            if (t.categories?.name?.toLowerCase().includes('giroconto')) return false;

            // Include se beneficiario è "Famiglia" (null) o un figlio
            return t.beneficiary_id === null || childrenIds.includes(t.beneficiary_id);
        });

        const currentMonthTotal = allFamilyExpenses
            .filter(t => format(new Date(t.date), "yyyy-MM") === currentMonthStr)
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const prevMonthTotal = allFamilyExpenses
            .filter(t => format(new Date(t.date), "yyyy-MM") === prevMonthStr)
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const trend = prevMonthTotal === 0 ? 0 : ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;

        return { total: currentMonthTotal, trend };
    }, [transactions, members, selectedMonth]);

    const familyMemberSummary = useMemo(() => {
        const monthStr = format(selectedMonth, "yyyy-MM");
        const allExpenses = [...groupExpenses, ...crossLoans];
        const currentMonthTxs = allExpenses.filter(t => format(new Date(t.date), "yyyy-MM") === monthStr);

        return members.map(m => {
            const total = currentMonthTxs
                .filter(t => t.payer_id === m.id)
                .reduce((acc, curr) => acc + Number(curr.amount), 0);

            return {
                member_name: m.name,
                total_amount: total
            };
        }).sort((a, b) => b.total_amount - a.total_amount);
    }, [groupExpenses, crossLoans, members, selectedMonth]);
    const buoniPastoBalance = useMemo(() => {
        const isBp = (t: Transaction) => t.accounts?.name?.toLowerCase().includes('buoni pasto');
        const bpIncome = transactions
            .filter(t => t.type === 'income' && isBp(t))
            .reduce((acc, curr) => acc + Number(curr.amount), 0);
        const bpExpense = transactions
            .filter(t => t.type === 'expense' && isBp(t))
            .reduce((acc, curr) => acc + Number(curr.amount), 0);
        return bpIncome - bpExpense;
    }, [transactions]);

    const dynamicBudget = useMemo(() => {
        const monthStr = format(selectedMonth, "yyyy-MM");

        return jointIncome
            .filter(t => format(new Date(t.date), "yyyy-MM") === monthStr)
            .reduce((acc, curr) => acc + Number(curr.amount), 0);
    }, [jointIncome, selectedMonth]);

    const categoryData = useMemo(() => {
        const monthStr = format(selectedMonth, "yyyy-MM");
        const currentMonthExpenses = groupExpenses.filter(t => format(new Date(t.date), "yyyy-MM") === monthStr);

        const totals: Record<string, number> = {};
        currentMonthExpenses.forEach(t => {
            const catName = t.categories?.name || 'Altro';
            totals[catName] = (totals[catName] || 0) + Number(t.amount);
        });

        return Object.entries(totals).map(([name, value]) => ({
            name,
            value,
            color: ''
        })).sort((a, b) => b.value - a.value);
    }, [groupExpenses, selectedMonth]);

    const currentMonthLabel = useMemo(() => {
        return format(selectedMonth, "MMMM yyyy", { locale: it });
    }, [selectedMonth]);

    const filteredTransactions = useMemo(() => {
        const all = [...groupExpenses, ...crossLoans, ...jointIncome]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (!searchTerm) return all.slice(0, 10);
        const lowerTerm = searchTerm.toLowerCase();
        return all.filter(tx =>
            (tx.description?.toLowerCase().includes(lowerTerm)) ||
            (tx.categories?.name?.toLowerCase().includes(lowerTerm)) ||
            (tx.payer?.name?.toLowerCase().includes(lowerTerm)) ||
            (tx.beneficiary?.name?.toLowerCase().includes(lowerTerm))
        ).slice(0, 20);
    }, [groupExpenses, crossLoans, jointIncome, searchTerm]);

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
        // BUG-10/BUG-6: identifica i 2 adulti via role, non per nome. Ordine deterministico per id.
        // ASSUNZIONE "2 ADULTI": il rebalancing supporta esattamente 2 parents (slot fabio/giulia).
        // Con 3+ parents, gli adulti oltre i primi 2 vengono ignorati: le loro spese e i loro
        // contributi NON entrano nel calcolo. Per estendere a N adulti serve riscrivere
        // rebalanceData/contributionStatus su una struttura per-membro, non una coppia.
        const parents = members.filter(m => m.role === 'parent').sort((a, b) => String(a.id).localeCompare(String(b.id)));
        if (parents.length > 2) {
            console.warn(`[rebalanceData] ${parents.length} parents trovati, supportati solo 2: gli altri sono ignorati nel rebalancing.`);
        }
        if (parents.length < 2) return null;
        const [fabio, giulia] = parents;

        if (groupExpenses.length === 0 && crossLoans.length === 0 && jointIncome.length === 0) return null;

        const monthStr = format(selectedMonth, "yyyy-MM");
        const isInSelectedMonth = (t: Transaction) => format(new Date(t.date), "yyyy-MM") === monthStr;

        // 1. Spese rilevanti per il rebalancing: gruppo + cross-loans, escludendo conti joint/buoni pasto
        // (le spese da conti joint/buoni pasto non gravano sul patrimonio personale del payer).
        const isFromJointOrMealVoucher = (t: Transaction) =>
            (t.accounts && t.accounts.owner_id === null) ||
            t.accounts?.name?.toLowerCase().includes('buoni pasto');

        const currentMonthExpenses = [...groupExpenses, ...crossLoans].filter(t =>
            isInSelectedMonth(t) && !isFromJointOrMealVoucher(t)
        );

        // 2. Contributi verso conti cointestati (escluso buoni pasto: non è patrimonio personale).
        // Income "esterno" (regalo/bonus/INPS/cashback/rimborso/assegno unico) escluso via helper.
        const currentMonthContributions = jointIncome.filter(t =>
            isInSelectedMonth(t) && isJointContribution(t)
        );

        const childrenIds = members.filter(m => ['child', 'pet'].includes(m.role)).map(m => m.id);
        const commonExpenses = currentMonthExpenses.filter(t => !t.beneficiary_id || childrenIds.includes(t.beneficiary_id));
        const fabioPaidCommon = commonExpenses.filter(t => t.payer_id === fabio.id).reduce((acc, t) => acc + Number(t.amount), 0);
        const giuliaPaidCommon = commonExpenses.filter(t => t.payer_id === giulia.id).reduce((acc, t) => acc + Number(t.amount), 0);

        const fabioPaidForGiulia = currentMonthExpenses.filter(t => t.payer_id === fabio.id && t.beneficiary_id === giulia.id).reduce((acc, t) => acc + Number(t.amount), 0);
        const giuliaPaidForFabio = currentMonthExpenses.filter(t => t.payer_id === giulia.id && t.beneficiary_id === fabio.id).reduce((acc, t) => acc + Number(t.amount), 0);

        // NUOVO: Calcolo contributi al conto cointestato
        const fabioContributions = currentMonthContributions.filter(t => t.payer_id === fabio.id).reduce((acc, t) => acc + Number(t.amount), 0);
        const giuliaContributions = currentMonthContributions.filter(t => t.payer_id === giulia.id).reduce((acc, t) => acc + Number(t.amount), 0);

        // Totale speso per la famiglia da ciascuno: contributi + spese personali non-self
        const fabioTotal = fabioContributions + fabioPaidCommon + fabioPaidForGiulia;
        const giuliaTotal = giuliaContributions + giuliaPaidCommon + giuliaPaidForFabio;
        const netBalance = (fabioTotal - giuliaTotal) / 2;

        return {
            fabio,
            giulia,
            netBalance,
            totalActivity: fabioPaidCommon + giuliaPaidCommon + fabioPaidForGiulia + giuliaPaidForFabio + fabioContributions + giuliaContributions
        };
    }, [groupExpenses, crossLoans, jointIncome, members, selectedMonth]);

    const contributionStatus = useMemo(() => {
        const monthStr = format(selectedMonth, "yyyy-MM");
        const currentMonthTxs = transactions.filter(t => format(new Date(t.date), "yyyy-MM") === monthStr);

        // Vedi nota "ASSUNZIONE 2 ADULTI" in rebalanceData: stessa limitazione qui.
        const parents = members.filter(m => m.role === 'parent').sort((a, b) => String(a.id).localeCompare(String(b.id)));
        const [fabio, giulia] = parents.length >= 2 ? parents : [undefined, undefined];

        // Quota = contributo personale al joint ≥600€ (esclude regalo/bonus/INPS via helper).
        const fabioPushed = currentMonthTxs.some(t =>
            isJointContribution(t) &&
            t.payer_id === fabio?.id &&
            Number(t.amount) >= 600
        );

        const giuliaPushed = currentMonthTxs.some(t =>
            isJointContribution(t) &&
            t.payer_id === giulia?.id &&
            Number(t.amount) >= 600
        );

        return { fabio: fabioPushed, giulia: giuliaPushed };
    }, [transactions, members, selectedMonth]);

    const handleSettlement = async () => {
        if (!rebalanceData || rebalanceData.netBalance === 0) return;

        try {
            const debtor = rebalanceData.netBalance > 0 ? rebalanceData.giulia : rebalanceData.fabio;
            const creditor = rebalanceData.netBalance > 0 ? rebalanceData.fabio : rebalanceData.giulia;
            // Il pareggio entra in `fabioForGiulia`/`giuliaForFabio` che la formula divide per 2.
            // Per azzerare un netBalance N serve quindi un trasferimento di 2N dal debitore al creditore.
            const amount = Math.abs(rebalanceData.netBalance) * 2;
            const settlementCat = categories.find(c => c.name.trim().toLowerCase() === 'altro') || categories[0];
            const debtorAccount = accounts.find((a: any) => a.owner_id === debtor.id);

            if (!debtorAccount) {
                alert("Errore: conto personale del debitore non trovato.");
                return;
            }

            const settlementDate = endOfMonth(selectedMonth);

            const { error } = await supabase.from('transactions').insert({
                payer_id: debtor.id,
                beneficiary_id: creditor.id,
                amount: amount,
                description: `Pareggio Spese - ${format(selectedMonth, 'MMMM yyyy', { locale: it })}`,
                type: 'expense',
                category_id: settlementCat?.id,
                account_id: debtorAccount.id,
                family_id: member?.family_id,
                date: format(settlementDate, 'yyyy-MM-dd')
            });

            if (error) throw error;
            fetchData();
        } catch (err: any) {
            console.error("Errore pareggio:", err);
            alert("Errore nel pareggio: " + (err?.message || String(err)));
        }
    };

    const handleRecordContribution = async (memberId: string) => {
        // BUG-13: blocco anti doppio click
        if (isSubmittingQuota) return;
        setIsSubmittingQuota(true);

        try {
            const memberObj = members.find(m => m.id === memberId);
            if (!memberObj) return;

            // BUG-9: cointestato = SOLO owner_id === null
            const sharedAccount = accounts.find((a: any) => a.owner_id === null);
            const personalAccount = accounts.find((a: any) => a.owner_id === memberObj.id);

            // BUG-12: lookup giroconto case-insensitive
            const catExpense = categories.find((c: any) => c.name.toLowerCase().includes('giroconto') && c.type === 'expense');
            const catIncome = categories.find((c: any) => c.name.toLowerCase().includes('giroconto') && c.type === 'income');

            const expenseCatId = catExpense?.id;
            const incomeCatId = catIncome?.id;

            if (!sharedAccount || !personalAccount || !expenseCatId || !incomeCatId) {
                alert("Errore: Configurazione incompleta. Assicurati di aver eseguito lo script SQL 'migration_giroconto.sql' e di aver configurato i conti.");
                return;
            }

            // BUG-8: data = fine del mese visualizzato, non oggi
            const dateStr = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

            const transactionsToInsert = [
                {
                    amount: 600,
                    description: 'Quota Mensile Fideuram (Automatico)',
                    type: 'expense',
                    category_id: expenseCatId,
                    payer_id: memberObj.id,
                    account_id: personalAccount.id,
                    family_id: memberObj.family_id,
                    date: dateStr
                },
                {
                    amount: 600,
                    description: 'Quota Mensile Fideuram (Automatico)',
                    type: 'income',
                    category_id: incomeCatId,
                    payer_id: memberObj.id,
                    beneficiary_id: null,
                    account_id: sharedAccount.id,
                    family_id: memberObj.family_id,
                    date: dateStr
                }
            ];

            const { error } = await supabase.from('transactions').insert(transactionsToInsert);
            if (error) throw error;

            fetchData();
        } catch (err: any) {
            console.error("Errore registrazione quota:", err);
            alert("Errore nella registrazione: " + err.message);
        } finally {
            setIsSubmittingQuota(false);
        }
    };

    // Vedi nota "ASSUNZIONE 2 ADULTI" in rebalanceData.
    const parents = members.filter(m => m.role === 'parent').sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const [parent1, parent2] = parents;

    return (
        <div className="space-y-12 animate-up">
            {/* 1. Welcome Hero Section - Ultra Compact */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-stretch">
                {/* Brand & Action Column */}
                <div className="lg:col-span-2 soft-card bg-white p-8 border-none flex flex-row items-center justify-between relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none relative z-10">Famiglia Cashflow</h1>
                        <div className="flex items-center gap-3 mt-3 relative z-10">
                            <button
                                onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
                                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <p className="text-slate-400 text-[10px] font-black flex items-center gap-1.5 uppercase tracking-widest min-w-[120px] justify-center">
                                <Activity size={12} className="text-indigo-500" />
                                {currentMonthLabel}
                            </p>
                            <button
                                onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
                                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-auto flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-200 transition-all active:scale-95 relative z-10"
                    >
                        <PlusCircle size={18} /> Nuova Operazione
                    </button>
                </div>

                {/* Quota Buttons Column */}
                <div className="lg:col-span-1 soft-card p-6 flex flex-col justify-center bg-white border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quote Mensili (600€)</p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => parent1 && !contributionStatus.fabio && handleRecordContribution(parent1.id)}
                            disabled={!parent1 || contributionStatus.fabio || isSubmittingQuota}
                            className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition-all shadow-sm relative group overflow-hidden ${contributionStatus.fabio
                                ? 'bg-emerald-500 text-white shadow-emerald-200'
                                : 'bg-white text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-slate-100'
                                }`}
                        >
                            <User size={16} /> {parent1?.name ?? '—'}
                        </button>
                        <button
                            onClick={() => parent2 && !contributionStatus.giulia && handleRecordContribution(parent2.id)}
                            disabled={!parent2 || contributionStatus.giulia || isSubmittingQuota}
                            className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 text-xs font-black transition-all shadow-sm relative group overflow-hidden ${contributionStatus.giulia
                                ? 'bg-emerald-500 text-white shadow-emerald-200'
                                : 'bg-white text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-slate-100'
                                }`}
                        >
                            <User size={16} /> {parent2?.name ?? '—'}
                        </button>
                    </div>
                </div>
            </div>
            {/* 2. Primary Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
                <MetricCard
                    label="Budget Disponibile"
                    value={stats.income}
                    icon={Wallet}
                    color="emerald"
                    trend={`${stats.incomeTrend > 0 ? '+' : ''}${stats.incomeTrend.toFixed(0)}% vs mese scorso`}
                />
                <MetricCard
                    label="Spese Totali (Famiglia)"
                    value={stats.expense}
                    icon={TrendingDown}
                    color="rose"
                    trend={`${stats.expenseTrend > 0 ? '+' : ''}${stats.expenseTrend.toFixed(0)}% vs mese scorso`}
                />
                <MetricCard
                    label="Spese Totali Effettive"
                    value={effectiveTotalExpenses.total}
                    icon={Receipt}
                    color="orange"
                    trend={`${effectiveTotalExpenses.trend > 0 ? '+' : ''}${effectiveTotalExpenses.trend.toFixed(0)}% vs mese scorso`}
                />
                <MetricCard
                    label="Bilancio Netto"
                    value={stats.balance}
                    icon={BarChart3}
                    color="indigo"
                    trend={stats.balance > 0 ? "Risparmio" : "Deficit"}
                />
                <MetricCard
                    label="Buoni Pasto"
                    value={buoniPastoBalance}
                    icon={UtensilsCrossed}
                    color="amber"
                    trend="Disponibilità BP"
                />
                <div className="xl:col-span-1">
                    <RebalanceMetricCard data={rebalanceData} onSettle={handleSettlement} />
                </div>
            </div>
            {/* 3. Analysis & Feed Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-8">
                {/* 3a. Main Analytics Card */}
                <div className="xl:col-span-2 soft-card p-4 md:p-8">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Distribuzione Spese</h3>
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Per Categoria (Mese Corrente)</p>
                        </div>
                    </div>
                    <CategoryPieChart data={categoryData} />
                </div>

                {/* 3b. Members Overview */}
                <div className="soft-card p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-slate-900">Pagine Membro</h3>
                        <Activity size={20} className="text-indigo-500" />
                    </div>

                    <div className="space-y-4">
                        {parents.map((m) => {
                            const memberStats = familyMemberSummary.find(s => s.member_name === m.name);
                            return (
                                <Link
                                    key={m.id}
                                    href={`/member/${m.id}`}
                                    className="group block p-6 bg-slate-50 hover:bg-indigo-600 rounded-3xl transition-all border border-slate-100/50 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-100"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-lg font-black text-indigo-600 group-hover:scale-110 transition-transform">
                                                {m.name[0]}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-900 group-hover:text-white transition-colors uppercase tracking-tight">{m.name}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-200 uppercase tracking-widest">Vai alla Dashboard →</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-rose-500 group-hover:text-white transition-colors">-€{Number(memberStats?.total_amount || 0).toLocaleString('it-IT')}</p>
                                            <p className="text-[8px] font-black text-slate-400 group-hover:text-indigo-200 uppercase tracking-widest mt-1">Spesi per famiglia</p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {members.some(m => m.role !== 'parent') && (
                        <div className="mt-8 pt-8 border-t border-slate-100">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Altri Membri</h4>
                            <div className="space-y-3">
                                {members.filter(m => m.role !== 'parent').map(m => (
                                    <Link key={m.id} href={`/member/${m.id}`} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                                        <span className="text-sm font-bold text-slate-600">{m.name}</span>
                                        <ArrowRight size={14} className="text-slate-300" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
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
                                                    window.location.href = `/member/${sug.id}`;
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
        violet: "bg-violet-50 text-violet-600 shadow-violet-50",
        orange: "bg-orange-50 text-orange-600 shadow-orange-50",
        amber: "bg-amber-50 text-amber-600 shadow-amber-50"
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
