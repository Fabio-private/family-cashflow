"use client";

import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
    children: React.ReactNode;
}

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AppLayout({ children }: AppLayoutProps) {
    const { member, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const isPublicPage = pathname === "/select-profile";

    useEffect(() => {
        if (!loading) {
            if (!member && !isPublicPage) {
                router.push("/select-profile");
            }
        }
    }, [member, loading, isPublicPage, router]);

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#fafafa]">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (isPublicPage) {
        return <>{children}</>;
    }

    if (!member) return null;

    return (
        <div className="flex h-screen w-full bg-[#f1f5f9] overflow-hidden flex-col md:flex-row">
            {/* Sidebar (Desktop only) */}
            <div className="hidden md:block">
                <Sidebar />
            </div>

            {/* Main Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 h-full md:ml-24">
                {/* Page Content Viewport */}
                <main className="flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-10 pb-24 md:pb-10">
                    <div className="max-w-[1600px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            {/* Bottom Nav (Mobile only) */}
            <BottomNav />
        </div>
    );
}
