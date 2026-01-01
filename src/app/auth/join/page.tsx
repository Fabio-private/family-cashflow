"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { UserCheck, Hash, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export default function JoinFamilyPage() {
    const { user, refreshMember } = useAuth();
    const [joinCode, setJoinCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!user) {
            router.push("/auth/login");
            return;
        }

        // 1. Verify Join Code
        const { data: family, error: familyError } = await supabase
            .from("families")
            .select("*")
            .eq("join_code", joinCode.trim().toUpperCase())
            .single();

        if (familyError || !family) {
            setError("Codice Famiglia non valido. Controlla e riprova.");
            setLoading(false);
            return;
        }

        // 2. We need a name for the member. Since they are joining, we might need a separate step or 
        // look for a temporary name. For now, we'll ask for it or use the email prefix.
        const emailPrefix = user.email?.split('@')[0] || "Nuovo Membro";

        const { error: memberError } = await supabase
            .from("family_members")
            .insert({
                name: emailPrefix,
                role: 'child', // Default to child/member until promoted by parent
                user_id: user.id,
                family_id: family.id
            });

        if (memberError) {
            setError("Errore durante l'unione alla famiglia: " + memberError.message);
            setLoading(false);
        } else {
            await refreshMember();
            router.push("/");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#fafafa]">
            {/* Background Decorations */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-indigo-50/50 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 -left-[10%] w-[35%] h-[35%] bg-blue-50/50 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-[440px] animate-up">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-indigo-50/50 mb-6 group transition-all hover:scale-105 active:scale-95">
                        <UserCheck className="text-indigo-600 group-hover:rotate-6 transition-transform" size={32} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Unisciti.</h1>
                    <p className="text-slate-500 font-medium">Inserisci il codice per accedere al budget di famiglia.</p>
                </div>

                <div className="soft-card p-10 bg-white/80 backdrop-blur-xl border-white shadow-2xl shadow-indigo-100/20">
                    <form onSubmit={handleJoin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Codice Famiglia</label>
                            <div className="relative group">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    required
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-black tracking-widest focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all placeholder:text-slate-200 uppercase"
                                    placeholder="FAM-XXX-XXX"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl animate-shake">
                                <p className="text-xs font-bold text-rose-500 text-center">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-slate-200 hover:bg-indigo-600 hover:shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? "Verifica codice..." : (
                                <>
                                    Unisciti <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-50 text-center">
                        <p className="text-sm font-bold text-slate-400">
                            Hai cambiato idea?{" "}
                            <Link href="/auth/register" className="text-indigo-600 hover:underline">Crea una nuova famiglia</Link>
                        </p>
                    </div>
                </div>

                <div className="mt-10 flex justify-center gap-8">
                    <div className="flex flex-col items-center gap-2">
                        <ShieldCheck className="text-slate-300" size={20} />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sicuro</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Sparkles className="text-slate-300" size={20} />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Privato</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
