"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/Header";
import { DateSelector } from "@/components/DateSelector";
import { NewsGrid } from "@/components/NewsGrid";

interface NewsItem {
    id: string;
    title: string;
    source_name: string;
    abstract: string;
    source_url: string;
    ranking_score: number;
    published_at: string;
    category?: string;
}

export default function Home() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [news, setNews] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchNews() {
            setIsLoading(true);
            const formattedDate = format(selectedDate, 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from('daily_news')
                .select('*')
                .eq('published_at', formattedDate)
                .order('ranking_score', { ascending: false });

            if (error) {
                console.error("Error fetching news:", error);
                setNews([]);
            } else {
                setNews(data || []);
            }
            setIsLoading(false);
        }

        fetchNews();
    }, [selectedDate]);

    return (
        <main className="min-h-screen bg-white">
            <Header />

            <div className="dashboard-container">
                <div className="mb-12">
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">
                        News in Tavola
                    </h1>
                    <p className="text-gray-500 font-medium">
                        Le notizie più interessanti dal mondo nel settore agroalimentare.
                    </p>
                </div>

                <DateSelector
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                />

                <div className="mt-8">
                    {isLoading ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-[300px] bg-gray-50 border border-gray-100 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <NewsGrid news={news} />
                    )}
                </div>
            </div>

            <footer className="mt-20 py-12 border-t border-gray-100 bg-gray-50/50">
                <div className="dashboard-container flex flex-col items-center text-center gap-6">
                    <span className="text-xs text-gray-400 font-medium">
                        Un prodotto di Food Hub Srl Società Benefit | Via Martiri della Libertà, 14/C 47521 Cesena (FC) | P.IVA 04598540401 | REA FO-425082
                    </span>
                    <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">
                        © 2025
                    </span>
                </div>
            </footer>
        </main>
    );
}
