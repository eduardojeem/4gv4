"use client"

import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { GlobalSearch } from '@/components/ui/global-search'
import { NotificationBell } from '@/components/ui/notification-bell'

import { MobileNavSheet } from '@/components/ui/mobile-nav-sheet'
import { ChevronDown, ChevronRight, Sun, Moon, ArrowLeft, Search } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useAdminLayout } from '@/contexts/AdminLayoutContext'
import { adminNavCategories, filterCategoriesByPermissions, getNavItemByKey } from '@/config/admin-navigation'
import { cn } from '@/lib/utils'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

interface AdminLayoutProps {
    children: React.ReactNode
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
    const [searchOpen, setSearchOpen] = useState(false)
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['analytics', 'operations', 'administration'])
    const { hasPermission, isAdmin } = useAuth()
    const { sidebarCollapsed: collapsed, toggleSidebar, darkMode, toggleDarkMode } = useAdminLayout()

    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // Determine active tab from URL or default to 'overview'
    const active = searchParams.get('tab') ?? 'overview'

    // Filter categories based on user permissions
    const visibleCategories = useMemo(
        () => filterCategoriesByPermissions(adminNavCategories, hasPermission, isAdmin),
        [hasPermission, isAdmin]
    )

    const currentItem = useMemo(() => getNavItemByKey(active), [active])

    const toggleCategory = useCallback((categoryId: string) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
            ? prev.filter(id => id !== categoryId)
            : [...prev, categoryId]
        )
    }, [])

    const handleKeydown = useCallback((e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault()
            setSearchOpen(true)
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault()
            toggleSidebar()
        }
    }, [toggleSidebar])

    useEffect(() => {
        window.addEventListener('keydown', handleKeydown)
        return () => window.removeEventListener('keydown', handleKeydown)
    }, [handleKeydown])

    // Mock search function
    const onSearch = (input: { query: string }) => {
        console.log('Searching:', input.query)
        return []
    }

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
            {/* Sidebar Overlay for Mobile */}
            {!collapsed && (
                <div 
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                aria-label="Menú lateral"
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-white dark:bg-gray-800 transition-all duration-300 ease-in-out lg:static shadow-lg lg:shadow-none",
                    collapsed ? 'w-20 -translate-x-full lg:translate-x-0' : 'w-72 translate-x-0'
                )}
            >
                {/* Sidebar Header */}
                <div className="flex h-16 items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700">
                    {!collapsed && (
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Admin Panel
                        </span>
                    )}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={toggleSidebar} 
                        className={cn("hidden lg:flex ml-auto text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white", collapsed && "mx-auto")}
                    >
                        {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5 rotate-90" />}
                    </Button>
                    {/* Mobile Close Button */}
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={toggleSidebar} 
                        className="lg:hidden text-gray-500"
                    >
                         <ArrowLeft className="h-5 w-5" />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
                    {visibleCategories.map((category) => {
                        const isExpanded = expandedCategories.includes(category.id)

                        return (
                            <div key={category.id} className="space-y-2">
                                {/* Category Label */}
                                {!collapsed && (
                                    <button
                                        onClick={() => toggleCategory(category.id)}
                                        className="flex w-full items-center justify-between px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                    >
                                        <span>{category.label}</span>
                                        {isExpanded ? (
                                            <ChevronDown className="h-3 w-3" />
                                        ) : (
                                            <ChevronRight className="h-3 w-3" />
                                        )}
                                    </button>
                                )}
                                
                                {collapsed && <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2" />}

                                {/* Category Items */}
                                {(collapsed || isExpanded) && (
                                    <div className="space-y-1">
                                        {category.items.map(({ key, label, icon: Icon, description, href }) => {
                                            const isActive = href === '/admin'
                                                ? pathname === href
                                                : pathname.startsWith(href || '')

                                            return (
                                                <Link
                                                    key={key}
                                                    href={href || '#'}
                                                    className={cn(
                                                        "group flex items-center rounded-xl transition-all duration-200",
                                                        collapsed 
                                                            ? 'justify-center p-3' 
                                                            : 'gap-3 px-3 py-2.5',
                                                        isActive
                                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium'
                                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                                                    )}
                                                    title={collapsed ? label : description}
                                                >
                                                    <Icon className={cn(
                                                        "flex-shrink-0 transition-colors",
                                                        collapsed ? "h-6 w-6" : "h-5 w-5",
                                                        isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-200"
                                                    )} />
                                                    {!collapsed && <span>{label}</span>}
                                                    
                                                    {/* Active Indicator */}
                                                    {!collapsed && isActive && (
                                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                                                    )}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </nav>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-2 bg-gray-50/50 dark:bg-gray-800/50">
                    <Link
                        href="/dashboard"
                        className={cn(
                            "flex items-center rounded-xl transition-all duration-200 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-600",
                            collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
                        )}
                        title="Volver al Dashboard"
                    >
                        <ArrowLeft className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
                        {!collapsed && <span className="text-sm font-medium">Volver al Dashboard</span>}
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="lg:hidden" 
                            onClick={toggleSidebar}
                        >
                            <Search className="h-5 w-5" /> {/* Using Search icon as menu trigger placeholder if needed or generic menu */}
                        </Button>
                        
                        <Breadcrumbs items={[
                            { label: 'Dashboard', href: '/dashboard' },
                            { label: 'Admin', href: '/admin' },
                            { label: currentItem?.label ?? 'Sección' }
                        ]} />
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search Bar */}
                        <div className="hidden md:flex relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input
                                className="w-64 pl-10 bg-gray-50 dark:bg-gray-900 border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all duration-200"
                                placeholder="Buscar (Ctrl+K)"
                                readOnly
                                onClick={() => setSearchOpen(true)}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                    <span className="text-xs">⌘</span>K
                                </kbd>
                            </div>
                        </div>

                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2" />

                        {/* Theme Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleDarkMode}
                            className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            {darkMode ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5 text-gray-500" />}
                        </Button>

                        {/* Notifications */}
                        <NotificationBell />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {children}
                    </div>
                </main>
            </div>

            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onSearch={onSearch} />
        </div>
    )
}

function AdminLayoutFallback() {
    return (
        <div className="flex h-screen bg-gray-50">
            <div className="w-72 border-r bg-white hidden lg:block p-6 space-y-6">
                <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
            <div className="flex-1 flex flex-col">
                <div className="h-16 border-b bg-white" />
                <div className="p-8 space-y-6">
                    <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
                    <div className="grid grid-cols-3 gap-6">
                        <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
                        <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
                        <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    )
}

export function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <Suspense fallback={<AdminLayoutFallback />}>
            <AdminLayoutContent>{children}</AdminLayoutContent>
        </Suspense>
    )
}
