"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { FamilyMember } from "@/lib/types";
import { User, Sparkles, ShieldCheck } from "lucide-react";

export default function SelectProfilePage() {
    const { selectMember } = useAuth();
    const router = useRouter();
    const [members, setMembers] = useState<FamilyMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMembers() {
            try {
                const { data, error } = await supabase
                    .from("family_members")
                    .select("*")
                    .order("name");

                if (data) {
                    setMembers(data as FamilyMember[]);
                }
            } catch (err) {
                console.error("Error fetching members:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchMembers();
    }, []);

    const handleSelect = (member: FamilyMember) => {
        selectMember(member);
        router.push("/");
        router.refresh();
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#fafafa]">
            {/* Background Decorations */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-50/50 rounded-full blur-[120px]" />
                <div className="absolute top-[60%] -left-[10%] w-[35%] h-[35%] bg-emerald-50/50 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-[600px] animate-up">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-indigo-50/50 mb-6 group">
                        <User className="text-indigo-600" size={32} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Chi sei?</h1>
                    <p className="text-slate-500 font-medium">Seleziona il tuo profilo per iniziare.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center p-20">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {members.length > 0 ? (
                            members.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => handleSelect(m)}
                                    className="soft-card p-8 bg-white/80 backdrop-blur-xl border-white shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all group text-left"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                            <User className="text-indigo-600 group-hover:text-white" size={32} />
                                        </div>
                                        <div className="p-2 rounded-full bg-slate-50 group-hover:bg-indigo-50">
                                            <Sparkles className="text-slate-300 group-hover:text-indigo-500" size={16} />
                                        </div>
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-900 mb-1">{m.name}</h2>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{m.role || 'Membro'}</p>
                                </button>
                            ))
                        ) : (
                            <div className="col-span-full p-10 text-center bg-white rounded-3xl shadow-sm border border-slate-100">
                                <p className="text-slate-500 font-bold">Nessun membro trovato nel database.</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-12 text-center space-y-4">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Built with Excellence by Antigravity</p>
                    <div className="flex justify-center gap-6">
                        <div className="flex items-center gap-2 text-slate-400">
                            <ShieldCheck size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Local Mode</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
