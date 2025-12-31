"use client";

import React from 'react';
import { format, subDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { it } from 'date-fns/locale';

interface DateSelectorProps {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
}

export function DateSelector({ selectedDate, onDateChange }: DateSelectorProps) {
    const dates = Array.from({ length: 5 }).map((_, i) => subDays(new Date(), i));

    const getDateLabel = (date: Date) => {
        if (isSameDay(date, new Date())) return 'Oggi';
        if (isSameDay(date, subDays(new Date(), 1))) return 'Ieri';
        return format(date, 'EEE d MMM', { locale: it });
    };

    return (
        <div className="flex items-center gap-4 mb-10 overflow-x-auto no-scrollbar pb-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Periodo:</span>
            <div className="flex gap-2">
                {dates.map((date) => {
                    const isActive = isSameDay(date, selectedDate);
                    return (
                        <button
                            key={date.toISOString()}
                            onClick={() => onDateChange(date)}
                            className={cn(
                                "px-5 py-2 rounded-md text-[13px] font-bold transition-all whitespace-nowrap",
                                isActive
                                    ? "bg-black text-white"
                                    : "text-gray-500 hover:text-black hover:bg-gray-50 bg-white border border-gray-100"
                            )}
                        >
                            {getDateLabel(date)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
