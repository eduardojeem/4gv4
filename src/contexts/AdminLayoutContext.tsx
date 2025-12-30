'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AdminLayoutContextValue {
    sidebarCollapsed: boolean
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void
    darkMode: boolean
    toggleDarkMode: () => void
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
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [darkMode, setDarkMode] = useState(false)

    // Load preferences from localStorage
    useEffect(() => {
        const savedCollapsed = localStorage.getItem('admin-sidebar-collapsed')
        const savedDarkMode = localStorage.getItem('admin-dark-mode')

        if (savedCollapsed !== null) {
            setSidebarCollapsed(savedCollapsed === 'true')
        }

        if (savedDarkMode !== null) {
            setDarkMode(savedDarkMode === 'true')
        }
    }, [])

    // Apply dark mode class to document
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [darkMode])

    const toggleSidebar = () => {
        setSidebarCollapsed(prev => {
            const newValue = !prev
            localStorage.setItem('admin-sidebar-collapsed', String(newValue))
            return newValue
        })
    }

    const toggleDarkMode = () => {
        setDarkMode(prev => {
            const newValue = !prev
            localStorage.setItem('admin-dark-mode', String(newValue))
            return newValue
        })
    }

    return (
        <AdminLayoutContext.Provider
            value={{
                sidebarCollapsed,
                toggleSidebar,
                setSidebarCollapsed,
                darkMode,
                toggleDarkMode
            }}
        >
            {children}
        </AdminLayoutContext.Provider>
    )
}
