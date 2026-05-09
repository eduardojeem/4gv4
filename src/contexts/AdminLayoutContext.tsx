'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'

interface AdminLayoutContextValue {
    sidebarCollapsed: boolean
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
}

const AdminLayoutContext = createContext<AdminLayoutContextValue | null>(null)

export function useAdminLayout() {
    const context = useContext(AdminLayoutContext)
    if (!context) {
        throw new Error('useAdminLayout must be used within AdminLayoutProvider')
    }
    return context
}

export function AdminLayoutProvider({ children }: { children: ReactNode }) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === 'undefined') {
            return false
        }

        return localStorage.getItem('admin-sidebar-collapsed') === 'true'
    })

    useEffect(() => {
        try {
            localStorage.setItem('admin-sidebar-collapsed', String(sidebarCollapsed))
        } catch (error) {
            console.error('Error saving admin sidebar state:', error)
        }
    }, [sidebarCollapsed])

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed(prev => !prev)
    }, [])

    const value = useMemo(
        () => ({
            sidebarCollapsed,
            toggleSidebar,
            setSidebarCollapsed,
        }),
        [sidebarCollapsed, toggleSidebar]
    )

    return (
        <AdminLayoutContext.Provider value={value}>
            {children}
        </AdminLayoutContext.Provider>
    )
}
