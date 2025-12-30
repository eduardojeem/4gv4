"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { GlobalSearch } from '@/components/ui/global-search'
import { NotificationBell } from '@/components/ui/notification-bell'

import { MobileNavSheet } from '@/components/ui/mobile-nav-sheet'
import { ChevronDown, ChevronRight, Sun, Moon, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useAdminLayout } from '@/contexts/AdminLayoutContext'
import { adminNavCategories, filterCategoriesByPermissions, getNavItemByKey } from '@/config/admin-navigation'
import { cn } from '@/lib/utils'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

interface AdminLayoutProps {
    children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
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

    const handleNavigate = useCallback((key: string) => {
        // Navigate by updating the 'tab' search param
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', key)
        router.push(`${pathname}?${params.toString()}`)
    }, [router, pathname, searchParams])

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

    // Mock search function (can be replaced with real logic or passed as prop if needed)
    const onSearch = (input: { query: string }) => {
        console.log('Searching:', input.query)
        return []
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[240px_1fr]">

            <aside
                aria-label="Menú lateral"
                className={cn(
                    "border-r bg-background transition-all duration-300 ease-in-out flex flex-col",
                    collapsed ? 'w-14' : 'w-full lg:w-[240px]',
                    "hidden lg:block" // Hide on mobile by default, handled by overlay/sheet if needed, or just keep simple
                )}
            >
                <div className="flex items-center justify-between px-3 py-3 h-14 border-b">
                    {!collapsed && <div className="text-sm font-semibold">Panel Admin</div>}
                    <Button variant="ghost" size="sm" onClick={toggleSidebar} aria-label="Alternar menú" className={cn("ml-auto", collapsed && "mx-auto")}>
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 rotate-90" />}
                    </Button>
                </div>
                <nav className="space-y-2 p-2 flex-1 overflow-y-auto" role="navigation">
                    {visibleCategories.map((category) => {
                        const isExpanded = expandedCategories.includes(category.id)

                        return (
                            <div key={category.id} className="space-y-1">
                                {/* Category Header */}
                                {!collapsed && (
                                    <button
                                        onClick={() => toggleCategory(category.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider",
                                            "text-muted-foreground hover:text-foreground transition-colors",
                                            "focus:outline-none focus:text-foreground"
                                        )}
                                        aria-expanded={isExpanded}
                                    >
                                        <span>{category.label}</span>
                                        {isExpanded ? (
                                            <ChevronDown className="h-3 w-3" />
                                        ) : (
                                            <ChevronRight className="h-3 w-3" />
                                        )}
                                    </button>
                                )}

                                {/* Category separator when collapsed */}
                                {collapsed && (
                                    <div className="w-full h-px bg-border my-2" aria-hidden="true" />
                                )}

                                {/* Category Items */}
                                {(collapsed || isExpanded) && (
                                    <div className={cn("space-y-0.5", !collapsed && "pl-1")}>
                                        {category.items.map(({ key, label, icon: Icon, description, href }) => {
                                            const isActive = href === '/admin'
                                                ? pathname === href
                                                : pathname.startsWith(href || '')

                                            return (
                                                <Link
                                                    key={key}
                                                    href={href || '#'}
                                                    className={cn(
                                                        "w-full flex items-center rounded-md transition-all duration-200",
                                                        collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2 text-sm',
                                                        "hover:bg-accent hover:text-accent-foreground",
                                                        isActive
                                                            ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                                                            : 'text-foreground'
                                                    )}
                                                    title={collapsed ? label : description}
                                                    aria-label={label}
                                                >
                                                    <Icon className={cn("flex-shrink-0", "h-4 w-4")} aria-hidden />
                                                    {!collapsed && <span className="truncate">{label}</span>}
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </nav>

                <div className="p-2 border-t mt-auto">
                    <Link
                        href="/dashboard"
                        className={cn(
                            "w-full flex items-center rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent",
                            collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2 text-sm'
                        )}
                        title="Volver al Dashboard"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {!collapsed && <span>Volver al Dashboard</span>}
                    </Link>
                </div>
            </aside>

            <section className="flex flex-col min-w-0">
                <header className="border-b bg-background h-14 flex items-center px-4 gap-4 sticky top-0 z-10">
                    <MobileNavSheet
                        categories={visibleCategories}
                        title="Panel Admin"
                        description="Accede a todas las secciones administrativas"
                    />

                    <Breadcrumbs items={[
                        { label: 'Dashboard', href: '/dashboard' },
                        { label: 'Admin', href: '/admin' },
                        { label: currentItem?.label ?? 'Sección' }
                    ]} />

                    <div className="ml-auto flex items-center gap-2">
                        <div className="hidden md:block relative">
                            <div className="relative">
                                <Input
                                    className="w-64 pl-8"
                                    placeholder="Buscar (Ctrl+K)"
                                    readOnly
                                    onClick={() => setSearchOpen(true)}
                                />
                                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleDarkMode}
                            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
                        >
                            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </Button>

                        <NotificationBell />
                    </div>
                </header>

                <main id="main-content" className="flex-1 p-4 overflow-y-auto">
                    {children}
                </main>
            </section>

            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onSearch={onSearch} />
        </div>
    )
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    )
}
