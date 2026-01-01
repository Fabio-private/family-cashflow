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
    MessageSquare,
    Settings,
    LogOut,
    Sparkles
} from "lucide-react";

const menuItems = [
    { icon: LayoutDashboard, href: "/", label: "Dashboard" },
    { icon: Wallet, href: "/transactions", label: "Wallet" },
    { icon: PieChart, href: "/analytics", label: "Analysis" },
    { icon: Calendar, href: "/calendar", label: "Events" },
    { icon: Share2, href: "/share", label: "Social" },
];

import { useAuth } from "@/context/AuthContext";

export function Sidebar() {
    const pathname = usePathname();
    const { member, signOut } = useAuth();

    return (
        <aside className="hidden md:flex fixed left-0 top-0 h-full w-24 bg-white/70 backdrop-blur-xl border-r border-slate-200/50 flex-col items-center py-10 z-50">
            {/* Elegant Logo Area */}
            <div className="mb-14">
                <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-indigo-100 ring-4 ring-white">
                    <Sparkles size={28} strokeWidth={2.5} />
                </div>
            </div>

            {/* Navigation Icons */}
            <nav className="flex-1 flex flex-col gap-8">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-icon ${isActive ? 'active' : ''}`}
                            title={item.label}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        </Link>
                    );
                })}
            </nav>

            {/* Profile & Logout */}
            <div className="mt-auto flex flex-col gap-8 items-center relative">
                <div className="relative group">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border-2 border-white shadow-sm overflow-hidden transition-all group-hover:scale-105">
                        <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member?.name || 'User')}&background=6366f1&color=fff&bold=true`}
                            className="w-full h-full object-cover"
                            alt="Profile"
                        />
                    </div>
                </div>

                <div className="w-10 h-px bg-slate-200/50"></div>

                <button className="nav-icon">
                    <Settings size={22} />
                </button>
                <button
                    onClick={() => signOut()}
                    className="nav-icon text-rose-400 hover:text-rose-600 hover:bg-rose-50/50 transition-colors"
                    title="Esci"
                >
                    <LogOut size={22} />
                </button>
            </div>
        </aside>
    );
}
