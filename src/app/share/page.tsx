"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Share2, Users, Shield, Link as LinkIcon, Sparkles, UserPlus, Check, Copy, User, Settings, Crown, Heart, Baby, Hash } from "lucide-react";

export default function SharePage() {
    const { member } = useAuth();
    const [family, setFamily] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [copied, setCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFamilyData = async () => {
            if (!member?.family_id) return;

            setIsLoading(true);

            // Fetch family info
            const { data: familyData } = await supabase
                .from("families")
                .select("*")
                .eq("id", member.family_id)
                .single();

            if (familyData) setFamily(familyData);

            // Fetch members
            const { data: membersData } = await supabase
                .from("family_members")
                .select("*")
                .eq("family_id", member.family_id)
                .order("name");

            if (membersData) setMembers(membersData);

            setIsLoading(false);
        };
        fetchFamilyData();
    }, [member?.family_id]);

    const copyJoinCode = () => {
        if (!family?.join_code) return;
        navigator.clipboard.writeText(family.join_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const updateRole = async (memberId: string, newRole: string) => {
        const { error } = await supabase
            .from("family_members")
            .update({ role: newRole })
            .eq("id", memberId);

        if (!error) {
            setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
        }
    };

    return (
        <div className="space-y-10 animate-up max-w-6xl mx-auto py-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest mb-4">
                        <Sparkles size={12} /> Family Hub
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">{family?.name || "Il Tuo Nucleo Familiare"}</h1>
                    <p className="text-slate-500 font-medium mt-1 text-lg">Gestisci chi ha accesso al budget e coordina la tua famiglia.</p>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group transition-all hover:border-indigo-100 pr-5">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Codice Famiglia</span>
                        <div className="bg-slate-50 p-2 rounded-xl text-slate-600 font-mono text-sm px-4 group-hover:bg-indigo-50/50 group-hover:text-indigo-600 transition-all flex items-center gap-2 font-bold">
                            <Hash size={14} className="text-slate-300" />
                            {family?.join_code || "------"}
                        </div>
                    </div>
                    <button
                        onClick={copyJoinCode}
                        className="flex flex-col items-center gap-1 text-indigo-600 font-black text-[10px] uppercase tracking-[0.1em] hover:scale-105 active:scale-95 transition-all mt-4"
                    >
                        {copied ? (
                            <><Check size={14} className="text-emerald-500" /> Copiato!</>
                        ) : (
                            <><Copy size={14} /> Copia</>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Members List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="soft-card p-0 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Users size={16} className="text-indigo-500" /> Membri Attivi
                            </h3>
                            <button className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                                <UserPlus size={14} /> Aggiungi Manualmente
                            </button>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {isLoading ? (
                                [1, 2, 3].map(i => (
                                    <div key={i} className="px-8 py-6 animate-pulse flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-100 rounded-2xl"></div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                                            <div className="h-3 bg-slate-50 rounded w-1/6"></div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                members.map((member) => (
                                    <div key={member.id} className="px-8 py-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm overflow-hidden border-2 border-slate-50 group-hover:border-indigo-100 transition-all">
                                                <img
                                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=f8fafc&color=64748b&bold=true`}
                                                    className="w-full h-full object-cover p-1"
                                                    alt={member.name}
                                                />
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-slate-900 leading-tight">{member.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <RoleBadge role={member.role} />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• Online</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <select
                                                value={member.role || 'child'}
                                                onChange={(e) => updateRole(member.id, e.target.value)}
                                                className="bg-slate-50 border-none rounded-xl text-[10px] font-black uppercase tracking-widest py-2 px-3 text-slate-500 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                                            >
                                                <option value="parent">Capofamiglia</option>
                                                <option value="child">Membro</option>
                                                <option value="pet">Membro Speciale</option>
                                            </select>
                                            <button className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all">
                                                <Settings size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                        <div className="relative z-10">
                            <h3 className="text-2xl font-black mb-4">Sincronizzazione Totale</h3>
                            <p className="text-indigo-100 font-medium leading-relaxed max-w-lg mb-8">
                                Tutti i membri vedranno le stesse transazioni in tempo reale. I genitori hanno pieno controllo su chi può eliminare o modificare le voci critiche.
                            </p>
                            <button className="px-8 py-3 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl">
                                Scopri di più sulla Privacy
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Column */}
                <div className="space-y-8">
                    <div className="soft-card p-8">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                            <Shield size={22} />
                        </div>
                        <h4 className="text-lg font-black text-slate-900 mb-3">Ruoli & Permessi</h4>
                        <div className="space-y-4">
                            <RoleDesc icon={Crown} title="Capofamiglia" desc="Accesso totale, gestione ruoli e conti bancari." color="text-amber-500" />
                            <RoleDesc icon={Heart} title="Membro" desc="Può inserire e visualizzare spese comuni." color="text-rose-500" />
                            <RoleDesc icon={Baby} title="Membro Speciale" desc="Profilo limitato, ottimo per animali o minori." color="text-indigo-500" />
                        </div>
                    </div>

                    <div className="soft-card bg-slate-900 text-white border-transparent p-8">
                        <h4 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-6">Prossimi Step</h4>
                        <ul className="space-y-5">
                            <li className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0"></div>
                                <div>
                                    <p className="text-xs font-black mb-1">Integrazione Email</p>
                                    <p className="text-[10px] font-medium text-slate-500">Notifiche push quando qualcuno aggiunge una spesa.</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-2 shrink-0"></div>
                                <div>
                                    <p className="text-xs font-black mb-1">Conti Condivisi</p>
                                    <p className="text-[10px] font-medium text-slate-500">Saldo unico per C/C cointestati.</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    switch (role) {
        case 'parent': return <span className="bg-amber-50 text-amber-600 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5"><Crown size={10} /> Capofamiglia</span>;
        case 'pet': return <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5"><Baby size={10} /> Special</span>;
        default: return <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">Membro</span>;
    }
}

function RoleDesc({ icon: Icon, title, desc, color }: any) {
    return (
        <div className="flex gap-3">
            <Icon size={16} className={`${color} mt-0.5 shrink-0`} />
            <div>
                <p className="text-xs font-black text-slate-800">{title}</p>
                <p className="text-[10px] font-medium text-slate-400 leading-normal">{desc}</p>
            </div>
        </div>
    );
}
