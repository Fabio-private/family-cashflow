import React from 'react';
import { ArrowRight, Bookmark } from 'lucide-react';

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

export function NewsCard({ news }: { news: NewsItem }) {
    const isHighScoring = news.ranking_score >= 8;
    const isMediumScoring = news.ranking_score >= 5 && news.ranking_score < 8;

    const scoreColor = isHighScoring
        ? "bg-[#47b27b]"
        : isMediumScoring
            ? "bg-orange-400"
            : "bg-gray-200";

    const getCategoryColor = (category?: string) => {
        if (!category) return "bg-gray-100 text-gray-600 border-gray-100";
        const cat = category.toLowerCase();
        if (cat.includes('tech') || cat.includes('innovazione')) return "bg-blue-50 text-blue-600 border-blue-100";
        if (cat.includes('green') || cat.includes('sostenibilit') || cat.includes('climate')) return "bg-[#47b27b]/10 text-[#47b27b] border-[#47b27b]/20";
        if (cat.includes('food') || cat.includes('prodotto')) return "bg-orange-50 text-orange-600 border-orange-100";
        if (cat.includes('mercato') || cat.includes('economia')) return "bg-purple-50 text-purple-600 border-purple-100";
        if (cat.includes('blog') || cat.includes('news')) return "bg-[#d31049]/10 text-[#d31049] border-[#d31049]/20";
        return "bg-gray-50 text-gray-500 border-gray-100";
    };

    return (
        <div className="news-card-b2b p-8 flex flex-col h-full group">
            <div className="flex justify-between items-start mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="px-3 py-1 bg-[#111111] rounded-[2px] text-[10px] font-bold text-white uppercase tracking-wider">
                        {news.source_name || 'Food Hub'}
                    </div>
                    {news.category && (
                        <div className={`px-3 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${getCategoryColor(news.category)}`}>
                            {news.category}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 ml-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${scoreColor}`} />
                        <span className="text-[11px] font-bold text-gray-400">Score: {news.ranking_score}/10</span>
                    </div>
                </div>
                <button className="text-gray-300 hover:text-black transition-colors">
                    <Bookmark className="w-5 h-5" />
                </button>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 leading-tight mb-4 group-hover:text-black transition-colors">
                {news.title}
            </h3>

            <div className="flex-1">
                <p className="text-gray-600 text-[15px] leading-relaxed mb-8 font-medium">
                    {news.abstract}
                </p>
            </div>

            <div className="flex justify-end mt-auto pt-6 border-t border-gray-100">
                <a
                    href={news.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#111111] hover:text-[#47b27b] transition-colors"
                >
                    <span className="uppercase tracking-widest text-[11px]">Leggi l'articolo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                </a>
            </div>
        </div>
    );
}
