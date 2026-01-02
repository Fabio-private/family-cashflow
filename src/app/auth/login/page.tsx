"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, LogIn, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (loginError) {
                setError(loginError.message === "Invalid login credentials" ? "Email o password non corretti." : loginError.message);
                setLoading(false);
            } else {
                // Login successful - navigate to home
                // Note: We don't setLoading(false) here because we're navigating away.
                // If navigation fails for some reason, the try-catch will handle it.
                router.push("/");
                router.refresh();
            }
        } catch (err) {
            console.error("Login error:", err);
            setError("Si è verificato un errore durante il login. Riprova.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#fafafa]">
            {/* Background Decorations */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-50/50 rounded-full blur-[120px]" />
                <div className="absolute top-[60%] -left-[10%] w-[35%] h-[35%] bg-emerald-50/50 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-[440px] animate-up">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-indigo-50/50 mb-6 group transition-all hover:scale-105 active:scale-95">
                        <ShieldCheck className="text-indigo-600 group-hover:rotate-6 transition-transform" size={32} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Benvenuti.</h1>
                    <p className="text-slate-500 font-medium">Accedi al tuo Family Budget Hub.</p>
                </div>

                <div className="soft-card p-10 bg-white/80 backdrop-blur-xl border-white shadow-2xl shadow-indigo-100/20">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="la-tua@email.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Password</label>
                                <button type="button" className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600">Dimenticata?</button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-slate-900 font-bold focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="••••••••"
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
                            {loading ? "Verifica in corso..." : (
                                <>
                                    Log In <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-50 text-center">
                        <p className="text-sm font-bold text-slate-400">
                            Non hai un account?{" "}
                            <Link href="/auth/register" className="text-indigo-600 hover:underline">Registrati ora</Link>
                        </p>
                    </div>
                </div>

                <div className="mt-10 text-center space-y-4">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Built with Excellence by Antigravity</p>
                    <div className="flex justify-center gap-6">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Sparkles size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Premium UI</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <ShieldCheck size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Secure Data</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
