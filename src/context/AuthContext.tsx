"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FamilyMember } from "@/lib/types";

interface AuthContextType {
    member: FamilyMember | null;
    loading: boolean;
    selectMember: (member: FamilyMember) => void;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [member, setMember] = useState<FamilyMember | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load member from localStorage on mount
        const savedMember = localStorage.getItem("family_member");
        if (savedMember) {
            try {
                setMember(JSON.parse(savedMember));
            } catch (e) {
                console.error("Error parsing saved member:", e);
                localStorage.removeItem("family_member");
            }
        }
        setLoading(false);
    }, []);

    const selectMember = (m: FamilyMember) => {
        setMember(m);
        localStorage.setItem("family_member", JSON.stringify(m));
    };

    const signOut = () => {
        setMember(null);
        localStorage.removeItem("family_member");
    };

    return (
        <AuthContext.Provider value={{ member, loading, selectMember, signOut }}>
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
