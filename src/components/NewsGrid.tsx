import React from 'react';
import { NewsCard } from './NewsCard';

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

export function NewsGrid({ news }: { news: NewsItem[] }) {
    if (news.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-gray-100 rounded-lg text-center">
                <h3 className="text-xl font-bold text-gray-900">Nessun dato disponibile</h3>
                <p className="text-gray-500 max-w-xs mt-2 text-sm">Non sono state trovate notizie rilevanti per la data selezionata.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {news.map((item) => (
                <NewsCard key={item.id} news={item} />
            ))}
        </div>
    );
}
