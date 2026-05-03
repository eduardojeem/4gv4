'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react'

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
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    // Load preferences from localStorage on mount
    useEffect(() => {
        const savedCollapsed = localStorage.getItem('dashboard-sidebar-collapsed')
        if (savedCollapsed !== null) {
            setSidebarCollapsed(savedCollapsed === 'true')
            return
        }
        // By default, keep sidebar closed on mobile to avoid overlaying content on first load.
        if (window.innerWidth < 1024) {
            setSidebarCollapsed(true)
        }
    }, [])

    // Save sidebar collapsed state to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('dashboard-sidebar-collapsed', String(sidebarCollapsed))
        } catch (error) {
            console.error('Error saving sidebar state:', error)
        }
    }, [sidebarCollapsed])

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
