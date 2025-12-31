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
    image_url?: string;
    ranking_score: number;
    published_at: string;
    category?: string;
}

export default function Home() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [news, setNews] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        async function fetchNews() {
            setIsLoading(true);
            const formattedDate = format(selectedDate, 'yyyy-MM-dd');

            // Fetch news using the verified schema
            let { data, error } = await supabase
                .from('daily_news')
                .select('*')
                .eq('published_at', formattedDate)
                .order('ranking_score', { ascending: false });

            if (error) {
                console.error("Supabase Query Error:", error);
                setErrorMessage(`Errore caricamento: ${error.message}`);
                setNews([]);
            } else if (!data || data.length === 0) {
                console.warn("Nessuna notizia per oggi, provo fallback.");
                const { data: latestData, error: latestError } = await supabase
                    .from('daily_news')
                    .select('*')
                    .order('published_at', { ascending: false })
                    .limit(10);

                if (!latestError && latestData && latestData.length > 0) {
                    setNews(latestData);
                    setErrorMessage(null);
                } else {
                    setNews([]);
                    setErrorMessage("In attesa del caricamento dei nuovi dati agrifood...");
                }
            } else {
                setNews(data);
                setErrorMessage(null);
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
                        News in Tavola <small className="text-[8px] opacity-0">V5</small>
                    </h1>
                    <div className="flex items-center gap-3">
                        <p className="text-gray-500 font-medium">
                            Le notizie più interessanti dal mondo nel settore agroalimentare.
                        </p>
                        {news.length > 0 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-[10px] font-bold rounded uppercase">
                                {news.length} Notizie trovate
                            </span>
                        )}
                    </div>
                </div>

                <DateSelector
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                />

                <div className="mt-8">
                    {errorMessage && (
                        <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm font-medium">
                            <h4 className="font-bold mb-1">Avviso di Sistema:</h4>
                            {errorMessage}
                        </div>
                    )}
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
