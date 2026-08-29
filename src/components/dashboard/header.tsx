'use client'

import { useEffect, useMemo, useState, useCallback, memo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, LogOut, User, Settings, Menu, Shield } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { GlobalHelpButton } from '@/components/help/HelpButton'
import { NotificationSystem, useNotifications, type Notification } from '@/components/dashboard/notification-system'
import { useGlobalNotifications } from '@/hooks/use-global-notifications'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { LogoutDialog } from '@/components/profile/logout-dialog'
import { useAuth } from '@/contexts/auth-context'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'
import { useDashboardSearch } from '@/hooks/use-dashboard-search'
import { BranchSelector } from '@/components/branches/branch-selector'
import { OrganizationSwitcher } from '@/components/saas/organization-switcher'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { cn } from '@/lib/utils'
import { SubscriptionChip } from '@/components/admin/SubscriptionChip'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

const GlobalSearch = dynamic(() => import('@/components/ui/global-search').then(mod => mod.GlobalSearch), { 
  ssr: false,
  loading: () => null 
})

export const Header = memo(function Header() {
  const [loading, setLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  // Se detecta post-montaje para evitar mismatch de hidratación.
  const [isMacPlatform, setIsMacPlatform] = useState(false)
  const router = useRouter()
  const { toggleSidebar } = useDashboardLayout()
  const { search, availableTypes } = useDashboardSearch()
  const { effectiveModules } = useSubscriptionStatus()
  const { user, signOut } = useAuth()

  // Notifications logic
  const { 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAll,
    generateStockNotifications
  } = useNotifications()
  const shouldTrackStock = user?.role === 'admin' || user?.role === 'vendedor'

  // Notificaciones globales (enviadas por el superadmin)
  const {
    items: globalItems,
    markAsRead: markGlobalAsRead,
    markAllAsRead: markAllGlobalAsRead,
    dismiss: dismissGlobal,
  } = useGlobalNotifications(!!user)

  const globalAsNotifications = useMemo<Notification[]>(() => {
    const typeMap = { info: 'info', warning: 'warning', success: 'success', danger: 'error' } as const
    return globalItems.map(g => ({
      id: g.id,
      type: typeMap[g.type],
      category: 'system' as const,
      title: g.title,
      message: g.body,
      timestamp: new Date(g.timestamp),
      read: g.read,
    }))
  }, [globalItems])

  const globalIds = useMemo(() => new Set(globalItems.map(g => g.id)), [globalItems])

  const allNotifications = useMemo(
    () => [...globalAsNotifications, ...notifications],
    [globalAsNotifications, notifications],
  )

  const handleMarkAsRead = useCallback((id: string) => {
    if (globalIds.has(id)) markGlobalAsRead(id)
    else markAsRead(id)
  }, [globalIds, markGlobalAsRead, markAsRead])

  const handleMarkAllAsRead = useCallback(() => {
    markAllGlobalAsRead()
    markAllAsRead()
  }, [markAllGlobalAsRead, markAllAsRead])

  const handleDeleteNotification = useCallback((id: string) => {
    if (globalIds.has(id)) dismissGlobal(id)
    else deleteNotification(id)
  }, [globalIds, dismissGlobal, deleteNotification])

  const handleClearAll = useCallback(() => {
    globalItems.forEach(g => dismissGlobal(g.id))
    clearAll()
  }, [globalItems, dismissGlobal, clearAll])

  // Low-stock check: trae solo las columnas de stock de productos activos y
  // deja el filtrado a generateStockNotifications (compara contra min_stock,
  // sin umbral hardcodeado que ignore productos con min_stock alto).
  const fetchLowStockNotifications = useCallback(async () => {
    if (!shouldTrackStock || !config.supabase.isConfigured) return
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('products')
        .select('id, name, stock_quantity, min_stock')
        .eq('is_active', true)
      if (data && data.length > 0) {
        generateStockNotifications(data as Parameters<typeof generateStockNotifications>[0])
      }
    } catch { /* ignore */ }
  }, [shouldTrackStock, generateStockNotifications])

  // Check low stock periodically
  useEffect(() => {
    if (!shouldTrackStock) return
    fetchLowStockNotifications()
    const interval = setInterval(fetchLowStockNotifications, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchLowStockNotifications, shouldTrackStock])

  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin'

  // Prefetch critical routes
  useEffect(() => {
    router.prefetch('/dashboard/profile')
    // /admin/settings solo es accesible para admins; el middleware rebota al resto.
    if (isAdminUser) router.prefetch('/admin/settings')
  }, [router, isAdminUser])

  useEffect(() => {
    setIsMacPlatform(/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent))
  }, [])

  // Keyboard shortcut Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Compact header on scroll for better content visibility
  useEffect(() => {
    const container = document.getElementById('dashboard-main')
    if (!container) return
    const onScroll = () => {
      setIsCompact(container.scrollTop > 16)
    }

    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = async () => {
    setLoading(true)
    try {
      await signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setLoading(false)
    }
  }

  const pathname = usePathname()
  const breadcrumb = useMemo(() => {
    const sectionMap: Array<{ prefix: string; label: string }> = [
      { prefix: '/dashboard/customers', label: 'Clientes' },
      { prefix: '/dashboard/orders', label: 'Pedidos' },
      { prefix: '/dashboard/products', label: 'Productos' },
      { prefix: '/dashboard/suppliers', label: 'Proveedores' },
      { prefix: '/dashboard/pos/caja', label: 'Caja' },
      { prefix: '/dashboard/pos', label: 'Punto de Venta' },
      { prefix: '/dashboard/repairs', label: 'Reparaciones' },
      { prefix: '/dashboard/technician', label: 'Panel Técnico' },
      { prefix: '/dashboard/reports', label: 'Reportes' },
      { prefix: '/dashboard/settings', label: 'Configuración' },
      { prefix: '/dashboard/catalog', label: 'Catálogo' },
      { prefix: '/dashboard/posts', label: 'Publicaciones' },
      { prefix: '/dashboard/profile', label: 'Perfil' },
      { prefix: '/dashboard/brands', label: 'Marcas' },
      { prefix: '/dashboard/categories', label: 'Categorías' },
      { prefix: '/dashboard/promotions', label: 'Promociones' },
      { prefix: '/dashboard/credits', label: 'Créditos' },
      { prefix: '/admin', label: 'Administración' },
      { prefix: '/dashboard', label: 'Dashboard' },
    ]

    const mapped = sectionMap.find(section => pathname === section.prefix || pathname.startsWith(`${section.prefix}/`))
    if (mapped) return mapped.label

    const lastSegment = pathname.split('/').filter(Boolean).pop()
    if (!lastSegment) return 'Dashboard'
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, ' ')
  }, [pathname])

  // Get user initials for avatar fallback
  const userInitials = useMemo(() => {
    if (!user?.profile?.name) return 'U'
    return user.profile.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [user])

  return (
    <header
      className={cn(
        "border-b border-border z-30 bg-background",
        "transition-[padding,box-shadow,background-color] duration-200",
        isCompact ? "px-3 py-2 sm:px-5 shadow-sm" : "px-3 py-2.5 sm:px-6 sm:py-3"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 lg:flex-nowrap lg:gap-4">
        {/* Mobile hamburger + Breadcrumb */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {/* Hamburger menu for mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-10 w-10 shrink-0 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb + Title */}
          <div className="min-w-0 flex flex-col">
            {breadcrumb !== 'Dashboard' && (
              <div className={cn("text-xs text-muted-foreground hidden sm:block", isCompact && "opacity-80")}>
                Dashboard / {breadcrumb}
              </div>
            )}
            <h2 className={cn("font-semibold truncate leading-tight transition-all duration-200", isCompact ? "text-base" : "text-lg")}>
              {breadcrumb}
            </h2>
          </div>
        </div>

        {/* Search */}
        <div className="order-3 hidden w-full md:order-none md:block md:max-w-sm md:flex-1 xl:max-w-md">
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-muted-foreground font-normal bg-muted/50 hover:bg-muted border-muted-foreground/10",
              isCompact ? "h-9" : "h-10"
            )}
            onClick={() => setSearchOpen(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            <span className="truncate">
              {effectiveModules.includes('repairs')
                ? 'Buscar productos, clientes, reparaciones...'
                : 'Buscar productos y clientes...'}
            </span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 shadow-sm">
              {isMacPlatform ? <><span className="text-xs">⌘</span>K</> : 'Ctrl+K'}
            </kbd>
          </Button>
        </div>

        {/* GlobalSearch Modal */}
        <GlobalSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSearch={search}
          availableTypes={availableTypes}
        />

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">

          <div className="hidden lg:block">
            <SubscriptionChip variant="header" />
          </div>

          <div className="hidden lg:block">
            <OrganizationSwitcher compact={isCompact} />
          </div>
          <div className="hidden lg:block">
            <BranchSelector compact={isCompact} />
          </div>
          <div className="hidden sm:block">
            <InstallPrompt />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 md:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Abrir busqueda"
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Notifications */}
            <NotificationSystem
              notifications={allNotifications}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
              onDeleteNotification={handleDeleteNotification}
              onClearAll={handleClearAll}
            />

            {/* Help */}
            <GlobalHelpButton className="hidden sm:flex" />

            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />

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
              <DropdownMenuLabel className="font-normal p-1">
                <div className="flex items-center gap-2.5 px-1 py-1.5">
                  <Avatar className="h-9 w-9 border border-border shadow-sm">
                    <AvatarImage src={user?.profile?.avatar_url || "/avatars/01.svg"} alt={user?.profile?.name || "Usuario"} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-0.5 min-w-0">
                    <p className="text-sm font-semibold leading-none truncate">{user?.profile?.name || 'Usuario'}</p>
                    <p className="text-xs leading-none text-muted-foreground break-all truncate">
                      {user?.email || 'usuario@email.com'}
                    </p>
                    {user?.role && (
                      <div className="pt-0.5">
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-full font-medium border capitalize",
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
              {isAdminUser && (
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
              )}
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
              {isAdminUser && (
                <DropdownMenuItem asChild>
                  <Link
                    href="/admin"
                    className="cursor-pointer py-2.5 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors mt-1 flex items-center w-full"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-3">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">Panel Admin</span>
                      <span className="text-xs text-muted-foreground">Administración del sistema</span>
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

        <div className="order-4 flex w-full min-w-0 gap-2 overflow-x-auto pb-0.5 lg:hidden">
          <div className="shrink-0">
            <SubscriptionChip variant="header" />
          </div>
          <div className="shrink-0">
            <OrganizationSwitcher compact />
          </div>
          <div className="shrink-0">
            <BranchSelector compact />
          </div>
          <div className="shrink-0 sm:hidden">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <LogoutDialog
        open={logoutOpen}
        loading={loading}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </header>
  )
})
