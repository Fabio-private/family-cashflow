"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    LayoutDashboard,
    Wallet,
    PieChart,
    Calendar,
    Share2,
    Settings,
    UserCircle
} from "lucide-react";

const menuItems = [
    { icon: LayoutDashboard, href: "/", label: "Home" },
    { icon: Wallet, href: "/transactions", label: "Conti" },
    { icon: PieChart, href: "/analytics", label: "Analisi" },
    { icon: Share2, href: "/share", label: "Hub" },
];

import { useAuth } from "@/context/AuthContext";

export function BottomNav() {
    const pathname = usePathname();
    const { member } = useAuth();

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex items-center justify-between z-50 md:hidden">
            {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
                    >
                        <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-indigo-50 shadow-sm' : ''}`}>
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
                    </Link>
                );
            })}

            <Link href="/share" className="flex flex-col items-center gap-1">
                <div className="w-9 h-9 rounded-xl overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-100">
                    <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member?.name || 'User')}&background=6366f1&color=fff&bold=true`}
                        className="w-full h-full object-cover"
                        alt="Profile"
                    />
                </div>
                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Io</span>
            </Link>
        </nav>
    );
}
