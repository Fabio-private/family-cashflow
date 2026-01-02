"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { UserCircle, Sparkles, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

interface Member {
    id: string;
    name: string;
    user_id: string | null;
}

export default function ProfileSetupPage() {
    const { user, refreshMember } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [linking, setLinking] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;

        const fetchMembers = async () => {
            console.log("👥 ProfileSetup: Fetching members...");
            try {
                // Add a small safety delay or timeout
                const { data, error } = await supabase
                    .from("family_members")
                    .select("id, name, user_id")
                    .order("name");

                if (error) throw error;
                if (isMounted && data) {
                    console.log("👥 ProfileSetup: Members loaded.");
                    setMembers(data);
                }
            } catch (err) {
                console.error("👥 ProfileSetup: Fetch error:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        if (user) {
            fetchMembers();
            // Force stop loading after 15 seconds as a fail-safe
            const timer = setTimeout(() => {
                if (isMounted && loading) {
                    console.warn("👥 ProfileSetup: Fetch timeout reached.");
                    setLoading(false);
                }
            }, 15000);
            return () => {
                isMounted = false;
                clearTimeout(timer);
            };
        } else {
            router.push("/auth/login");
        }

        return () => { isMounted = false; };
    }, [user, router]);

    const handleLinkProfile = async (memberId: string) => {
        setLinking(memberId);
        const { error } = await supabase
            .from("family_members")
            .update({ user_id: user?.id })
            .eq("id", memberId);

        if (!error) {
            await refreshMember();
            router.push("/");
        } else {
            console.error("Error linking profile:", error);
            setLinking(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#fafafa]">
            <div className="w-full max-w-[600px] animate-up">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2.5rem] bg-white border border-slate-100 shadow-xl shadow-indigo-50/50 mb-8 group transition-all hover:scale-105 active:scale-95">
                        <UserCircle className="text-indigo-600" size={40} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Chi Sei?</h1>
                    <p className="text-slate-500 font-medium">Collega il tuo account a uno dei profili esistenti per iniziare.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {members.map((member) => {
                        const isLinked = !!member.user_id;
                        const isMe = member.user_id === user?.id;

                        return (
                            <button
                                key={member.id}
                                disabled={isLinked && !isMe || !!linking}
                                onClick={() => handleLinkProfile(member.id)}
                                className={`
                                    soft-card p-8 flex flex-col items-center gap-6 group transition-all relative overflow-hidden
                                    ${isMe ? 'ring-2 ring-indigo-600 border-indigo-100 bg-indigo-50/10' : 'bg-white/80'}
                                    ${isLinked && !isMe ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-100/30'}
                                `}
                            >
                                <div className="w-20 h-20 rounded-full bg-slate-50 border-2 border-slate-100 flex items-center justify-center overflow-hidden">
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=f8fafc&color=64748b&bold=true`}
                                        className="w-full h-full object-cover"
                                        alt={member.name}
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-xl font-black text-slate-900 leading-tight mb-1">{member.name}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {isLinked ? 'Già Collegato' : 'Libero'}
                                    </p>
                                </div>

                                {linking === member.id ? (
                                    <Loader2 className="animate-spin text-indigo-600 mt-2" size={24} />
                                ) : (
                                    isMe ? (
                                        <CheckCircle2 className="text-indigo-600 mt-2" size={24} />
                                    ) : !isLinked && (
                                        <div className="mt-2 w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                            <ArrowRight size={20} />
                                        </div>
                                    )
                                )}

                                {isMe && (
                                    <div className="absolute top-4 right-4 animate-pulse">
                                        <Sparkles size={16} className="text-indigo-400" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-12 text-center pt-8 border-t border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed max-w-sm mx-auto">
                        Nota: I profili dei bambini e degli altri membri (Dante, Ludovica, ecc.) non necessitano di login e devono rimanere scollegati.
                    </p>
                </div>
            </div>
        </div>
    );
}
