'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TechnicianSidebar } from './TechnicianSidebar'
import { TechnicianHeader } from './TechnicianHeader'

interface TechnicianLayoutProps {
    children: React.ReactNode
}

export function TechnicianLayout({ children }: TechnicianLayoutProps) {
    const [mobileOpen, setMobileOpen] = useState(false)

    return (
        <div className="flex h-screen bg-background">
            {/* Mobile sidebar overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar: hidden off-screen on mobile, always visible on md+ */}
            <div
                className={`fixed inset-y-0 left-0 z-30 transition-transform duration-300 md:static md:translate-x-0 ${
                    mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                }`}
            >
                <TechnicianSidebar />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile hamburger lives in TechnicianHeader's left slot via portal or we pass as prop below */}
                <div className="relative">
                    {/* Hamburger only visible on mobile */}
                    <button
                        className="absolute left-4 top-1/2 -translate-y-1/2 md:hidden z-10 p-2 rounded-md hover:bg-muted"
                        onClick={() => setMobileOpen(v => !v)}
                        aria-label="Abrir menú"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <TechnicianHeader />
                </div>
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
