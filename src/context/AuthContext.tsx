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
        } else if (error && error.code !== "PGRST116") {
            console.error("Error fetching member profile:", error);
        }
    };

    useEffect(() => {
        const getInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const currUser = session?.user ?? null;
            setUser(currUser);
            if (currUser) await refreshMember(currUser);
            setLoading(false);
        };

        getInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Skip INITIAL_SESSION - already handled by getInitialSession()
            if (event === 'INITIAL_SESSION') return;

            const currUser = session?.user ?? null;
            setUser(currUser);
            if (currUser) {
                await refreshMember(currUser);
            } else {
                setMember(null);
            }
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
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
