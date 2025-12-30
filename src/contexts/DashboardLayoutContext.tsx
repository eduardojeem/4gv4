'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react'

interface DashboardLayoutContextValue {
    sidebarCollapsed: boolean
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
    userRole: 'admin' | 'vendedor' | 'tecnico' | 'cliente'
    setUserRole: (role: 'admin' | 'vendedor' | 'tecnico' | 'cliente') => void
    userData: {
        name: string
        email: string
        avatar?: string
    } | null
    setUserData: (data: any) => void
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
    // Sidebar collapsed state with localStorage persistence
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    // User role state
    const [userRole, setUserRole] = useState<'admin' | 'vendedor' | 'tecnico' | 'cliente'>('vendedor')

    // User data state
    const [userData, setUserData] = useState<{
        name: string
        email: string
        avatar?: string
    } | null>(null)

    // Load preferences from localStorage on mount
    useEffect(() => {
        const savedCollapsed = localStorage.getItem('dashboard-sidebar-collapsed')
        if (savedCollapsed !== null) {
            setSidebarCollapsed(savedCollapsed === 'true')
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
        userRole,
        setUserRole,
        userData,
        setUserData
    }), [sidebarCollapsed, toggleSidebar, userRole, userData])

    return (
        <DashboardLayoutContext.Provider value={value}>
            {children}
        </DashboardLayoutContext.Provider>
    )
}
