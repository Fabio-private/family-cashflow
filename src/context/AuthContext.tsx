"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { FamilyMember } from "@/lib/types";

interface AuthContextType {
    user: User | null;
    member: FamilyMember | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshMember: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [member, setMember] = useState<FamilyMember | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshMember = async (currUser?: User | null) => {
        const targetUser = currUser || user;
        if (!targetUser) {
            setMember(null);
            return;
        }

        const { data, error } = await supabase
            .from("family_members")
            .select("*")
            .eq("user_id", targetUser.id)
            .single();

        if (data) {
            setMember(data as FamilyMember);
        } else {
            if (error && error.code !== "PGRST116") {
                console.error("Error fetching member profile:", error);
            }
            setMember(null);
        }
    };

    useEffect(() => {
        let isMounted = true;

        // GLOBAL SAFETY TIMEOUT: Force loading false after 10s no matter what
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn("🔐 Auth: Safety timeout reached. Forcing loading false.");
                setLoading(false);
            }
        }, 10000);

        const getInitialSession = async () => {
            console.log("🔐 Auth: Getting initial session...");
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;

                const currUser = session?.user ?? null;
                if (isMounted) {
                    setUser(currUser);
                    if (currUser) {
                        console.log("🔐 Auth: User found, fetching member...");
                        await refreshMember(currUser);
                    } else {
                        console.log("🔐 Auth: No user found in session.");
                    }
                }
            } catch (err) {
                console.error("🔐 Auth: Initialization error:", err);
            } finally {
                if (isMounted) {
                    console.log("🔐 Auth: Initialization sequence finished.");
                    setLoading(false);
                    clearTimeout(safetyTimeout);
                }
            }
        };

        getInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`🔐 Auth Event: ${event}`);

            // Skip INITIAL_SESSION - already handled by getInitialSession()
            if (event === 'INITIAL_SESSION') return;

            const currUser = session?.user ?? null;
            if (isMounted) {
                setUser(currUser);
                if (currUser) {
                    await refreshMember(currUser);
                } else {
                    setMember(null);
                }
                setLoading(false);
                clearTimeout(safetyTimeout);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setMember(null);
    };

    return (
        <AuthContext.Provider value={{ user, member, loading, signOut, refreshMember }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
