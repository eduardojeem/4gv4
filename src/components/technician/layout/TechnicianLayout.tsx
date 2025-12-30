'use client'

import { ReactNode } from 'react'
import { TechnicianSidebar } from './TechnicianSidebar'
import { TechnicianHeader } from './TechnicianHeader'

interface TechnicianLayoutProps {
    children: ReactNode
}

export function TechnicianLayout({ children }: TechnicianLayoutProps) {
    return (
        <div className="flex h-screen bg-background">
            <TechnicianSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <TechnicianHeader />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
