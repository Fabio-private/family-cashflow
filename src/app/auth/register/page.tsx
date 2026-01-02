"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, Mail, Lock, User, ArrowRight, ShieldCheck, Sparkles, Building2 } from "lucide-react";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // 1. Sign Up
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        if (authData.user) {
            router.push("/auth/profile-setup");
            router.refresh();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#fafafa]">
            {/* Background Decorations */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-50/50 rounded-full blur-[120px]" />
                <div className="absolute bottom-[20%] -right-[10%] w-[35%] h-[35%] bg-emerald-50/50 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-[500px] animate-up">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-indigo-50/50 mb-6 group transition-all hover:scale-105 active:scale-95">
                        <UserPlus className="text-indigo-600 group-hover:rotate-6 transition-transform" size={32} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Inizia Ora.</h1>
                    <p className="text-slate-500 font-medium">Crea la tua famiglia digitale e prendi il controllo.</p>
                </div>

                <div className="soft-card p-10 bg-white/80 backdrop-blur-xl border-white shadow-2xl shadow-indigo-100/20">
                    <form onSubmit={handleRegister} className="space-y-6">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Il Tuo Nome</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 outline-none transition-all placeholder:text-slate-300 text-sm"
                                        placeholder="Esempio: Fabio"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 outline-none transition-all placeholder:text-slate-300 text-sm"
                                    placeholder="la-tua@email.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 outline-none transition-all placeholder:text-slate-300 text-sm"
                                    placeholder="Minimo 6 caratteri"
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
                            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? "Creazione account..." : (
                                <>
                                    Crea Account <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-50 text-center">
                        <p className="text-sm font-bold text-slate-400">
                            Hai già un account?{" "}
                            <Link href="/auth/login" className="text-indigo-600 hover:underline">Accedi</Link>
                        </p>
                    </div>
                </div>

                <div className="mt-8 text-center bg-slate-100/50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                        Crea il tuo account per accedere al budget condiviso della tua famiglia.
                    </p>
                </div>
            </div>
        </div>
    );
}
