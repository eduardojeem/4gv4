"use client"

import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { GlobalSearch } from '@/components/ui/global-search'
import { NotificationBell } from '@/components/ui/notification-bell'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { BranchSelector } from '@/components/branches/branch-selector'
import { OrganizationSwitcher } from '@/components/saas/organization-switcher'
import { ChevronDown, ChevronRight, ArrowLeft, Search, Crown, LayoutDashboard, User, Settings, LogOut, Shield } from 'lucide-react'
import { SubscriptionChip } from '@/components/admin/SubscriptionChip'
import { useAuth } from '@/contexts/auth-context'
import { useAdminLayout } from '@/contexts/AdminLayoutContext'
import { adminNavCategories, filterCategoriesByPermissions, getNavItemByKey } from '@/config/admin-navigation'
import { cn } from '@/lib/utils'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogoutDialog } from '@/components/profile/logout-dialog'

interface AdminLayoutProps {
    children: React.ReactNode
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
    const [searchOpen, setSearchOpen] = useState(false)
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['analytics', 'operations', 'administration'])
    const { sidebarCollapsed: collapsed, toggleSidebar } = useAdminLayout()
    const { hasPermission, isAdmin, isSuperAdmin, user, signOut } = useAuth()
    const [logoutOpen, setLogoutOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleLogout = async () => {
        setLoading(true)
        try {
            await new Promise(resolve => setTimeout(resolve, 500))
            await signOut()
            router.push('/login')
            router.refresh()
        } catch (error) {
            console.error('Error logging out:', error)
        } finally {
            setLoading(false)
        }
    }

    const userInitials = useMemo(() => {
        if (!user?.profile?.name) return 'U'
        return user.profile.name
            .split(' ')
            .map((n: string) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()
    }, [user])

    const searchParams = useSearchParams()
    const pathname = usePathname()

    // Determine active tab from URL or default to 'overview'
    const active = searchParams.get('tab') ?? 'overview'

    const currentItem = useMemo(() => getNavItemByKey(active), [active])
    const visibleCategories = useMemo(
        () => filterCategoriesByPermissions(adminNavCategories, hasPermission, isAdmin, isSuperAdmin),
        [hasPermission, isAdmin, isSuperAdmin]
    )

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
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
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
                    "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card text-card-foreground transition-all duration-300 ease-in-out lg:static shadow-lg lg:shadow-none",
                    collapsed ? 'w-20 -translate-x-full lg:translate-x-0' : 'w-72 translate-x-0'
                )}
            >
                {/* Sidebar Header */}
                <div className="flex h-16 items-center justify-between border-b border-border px-6">
                    {!collapsed && (
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Admin
                        </span>
                    )}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={toggleSidebar} 
                        className={cn("ml-auto hidden text-muted-foreground hover:text-foreground lg:flex", collapsed && "mx-auto")}
                    >
                        {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5 rotate-90" />}
                    </Button>
                    {/* Mobile Close Button */}
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={toggleSidebar} 
                        className="text-muted-foreground lg:hidden"
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
                                        className="flex w-full items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <span>{category.label}</span>
                                        {isExpanded ? (
                                            <ChevronDown className="h-3 w-3" />
                                        ) : (
                                            <ChevronRight className="h-3 w-3" />
                                        )}
                                    </button>
                                )}
                                
                                {collapsed && <div className="mx-2 h-px bg-border" />}

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
                                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                                    )}
                                                    title={collapsed ? label : description}
                                                >
                                                    <Icon className={cn(
                                                        "flex-shrink-0 transition-colors",
                                                        collapsed ? "h-6 w-6" : "h-5 w-5",
                                                        isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground group-hover:text-foreground"
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
                <div className="space-y-2 border-t border-border bg-muted/20 p-4">
                    <SubscriptionChip variant="sidebar" />
                    <Link
                        href="/dashboard"
                        className={cn(
                            "flex items-center rounded-xl border border-transparent text-muted-foreground shadow-sm transition-all duration-200 hover:border-border hover:bg-background hover:text-foreground",
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
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/80">
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
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-blue-500" />
                            <Input
                                className="w-64 border-border/60 bg-muted/50 pl-10 transition-all duration-200 focus-visible:bg-background"
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

                        {user?.role === 'super_admin' && (
                            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 border-purple-200/60 dark:border-purple-800/40 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 shadow-sm">
                                <Link href="/superadmin" className="flex items-center gap-1.5">
                                    <Crown className="h-4 w-4 shrink-0" />
                                    <span className="hidden lg:inline font-medium">Super Admin</span>
                                </Link>
                            </Button>
                        )}

                        {(user?.role === 'admin' || user?.role === 'super_admin') && (
                            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 border-border/80 shadow-sm">
                                <Link href="/dashboard" className="flex items-center gap-1.5">
                                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                                    <span className="hidden lg:inline font-medium">Dashboard</span>
                                </Link>
                            </Button>
                        )}

                        <OrganizationSwitcher compact />
                        <BranchSelector compact />

                        <div className="mx-2 h-6 w-px bg-border/60" />

                        {/* Theme Toggle */}
                        <ThemeToggle />

                        {/* Notifications */}
                        <NotificationBell />

                        <div className="mx-1 h-5 w-px bg-border/60" />

                        {/* User menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-transparent hover:ring-primary/10 transition-all p-0">
                                    <Avatar className="h-8 w-8 border border-border shadow-sm">
                                        <AvatarImage src={user?.profile?.avatar_url || "/avatars/01.svg"} alt={user?.profile?.name || "Usuario"} />
                                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">{userInitials}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64 p-2" align="end" forceMount sideOffset={8}>
                                <DropdownMenuLabel className="font-normal p-2">
                                    <div className="flex flex-col space-y-1.5">
                                        <p className="text-sm font-semibold leading-none">{user?.profile?.name || 'Usuario'}</p>
                                        <p className="text-xs leading-none text-muted-foreground break-all">
                                            {user?.email || 'usuario@email.com'}
                                        </p>
                                        {user?.role && (
                                            <div className="pt-1">
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium border capitalize",
                                                    user.role === 'admin'
                                                        ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/50"
                                                        : user.role === 'vendedor'
                                                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50"
                                                        : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-600/50"
                                                )}>
                                                    {user.role}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="my-2" />
                                <DropdownMenuItem asChild>
                                    <Link
                                        href="/dashboard/profile"
                                        className="cursor-pointer py-2.5 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors flex items-center w-full"
                                    >
                                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary mr-3">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">Mi Perfil</span>
                                            <span className="text-xs text-muted-foreground">Ver información personal</span>
                                        </div>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link
                                        href="/admin/settings"
                                        className="cursor-pointer py-2.5 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors mt-1 flex items-center w-full"
                                    >
                                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary mr-3">
                                            <Settings className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">Configuración</span>
                                            <span className="text-xs text-muted-foreground">Ajustes del sistema</span>
                                        </div>
                                    </Link>
                                </DropdownMenuItem>
                                {user?.role === 'super_admin' && (
                                    <DropdownMenuItem asChild>
                                        <Link
                                            href="/superadmin"
                                            className="cursor-pointer py-2.5 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors mt-1 flex items-center w-full"
                                        >
                                            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-3">
                                                <Shield className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-medium">Super Admin</span>
                                                <span className="text-xs text-muted-foreground">Panel global SaaS</span>
                                            </div>
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="my-2" />
                                <DropdownMenuItem
                                    onClick={() => setLogoutOpen(true)}
                                    disabled={loading}
                                    className="cursor-pointer py-2.5 px-3 text-red-600 focus:text-red-700 focus:bg-red-50 rounded-md transition-colors mt-1 group"
                                >
                                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-red-100 text-red-600 group-hover:bg-red-200 group-hover:text-red-700 transition-colors mr-3">
                                        <LogOut className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm font-medium">Cerrar Sesión</span>
                                        <span className="text-xs text-red-600/70">Salir del sistema</span>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
            <LogoutDialog
                open={logoutOpen}
                loading={loading}
                onClose={() => setLogoutOpen(false)}
                onConfirm={handleLogout}
            />
        </div>
    )
}

function AdminLayoutFallback() {
    return (
        <div className="flex h-screen bg-background text-foreground">
            <div className="hidden w-72 space-y-6 border-r border-border bg-card p-6 lg:block">
                <div className="h-8 w-32 rounded bg-muted animate-pulse" />
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-10 rounded-xl bg-muted/70 animate-pulse" />
                    ))}
                </div>
            </div>
            <div className="flex-1 flex flex-col">
                <div className="h-16 border-b border-border bg-background/80" />
                <div className="p-8 space-y-6">
                    <div className="h-32 rounded-xl bg-muted animate-pulse" />
                    <div className="grid grid-cols-3 gap-6">
                        <div className="h-64 rounded-xl bg-muted animate-pulse" />
                        <div className="h-64 rounded-xl bg-muted animate-pulse" />
                        <div className="h-64 rounded-xl bg-muted animate-pulse" />
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
