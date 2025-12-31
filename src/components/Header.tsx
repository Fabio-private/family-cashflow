import React from 'react';
import { User } from 'lucide-react';
import Image from 'next/image';

export function Header() {
    return (
        <header className="px-12 py-6 flex justify-between items-center border-b border-gray-50 bg-white sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <div className="relative w-[180px] h-[50px]">
                    <Image
                        src="/logo-foodhub.png"
                        alt="Food Hub Logo"
                        fill
                        className="object-contain object-left"
                        priority
                    />
                </div>
            </div>

            <div className="flex items-center gap-6 h-10">
                <div className="flex items-center gap-3 pl-2 cursor-pointer group">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                        <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="hidden lg:flex flex-col text-left">
                        <span className="text-xs font-bold text-gray-900 leading-none">Food Hub Team</span>
                        <span className="text-[10px] text-gray-400 font-medium">Innovatore</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
