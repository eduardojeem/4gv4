'use client'

import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react'

interface DashboardLayoutContextValue {
    sidebarCollapsed: boolean
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
}

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | null>(null)

export function useDashboardLayout() {
    const context = useContext(DashboardLayoutContext)
    if (!context) {
        throw new Error('useDashboardLayout must be used within DashboardLayoutProvider')
    }
    return context
}

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
    // Cada entrada o recarga comienza contraída. El estado se conserva
    // solamente mientras este layout sigue montado durante la navegación.
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed(prev => !prev)
    }, [])

    const value = useMemo(() => ({
        sidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
    }), [sidebarCollapsed, toggleSidebar])

    return (
        <DashboardLayoutContext.Provider value={value}>
            {children}
        </DashboardLayoutContext.Provider>
    )
}
