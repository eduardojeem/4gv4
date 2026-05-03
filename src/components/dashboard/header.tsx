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
import { NotificationSystem, useNotifications } from '@/components/dashboard/notification-system'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { LogoutDialog } from '@/components/profile/logout-dialog'
import { useAuth } from '@/contexts/auth-context'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'
import { useDashboardSearch } from '@/hooks/use-dashboard-search'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { cn } from '@/lib/utils'

const GlobalSearch = dynamic(() => import('@/components/ui/global-search').then(mod => mod.GlobalSearch), { 
  ssr: false,
  loading: () => null 
})

export const Header = memo(function Header() {
  const [loading, setLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const router = useRouter()
  const { toggleSidebar } = useDashboardLayout()
  const { search } = useDashboardSearch()
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

  // Lean low-stock check — only fetches aggregate data, not all products
  const fetchLowStockNotifications = useCallback(async () => {
    if (!shouldTrackStock || !config.supabase.isConfigured) return
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('products')
        .select('id, name, stock_quantity, min_stock')
        .eq('is_active', true)
        .lte('stock_quantity', 10) // pre-filter: only potentially low-stock products
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

  // Prefetch critical routes
  useEffect(() => {
    router.prefetch('/dashboard/profile')
    router.prefetch('/dashboard/settings')
  }, [router])

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
      // Small delay for better UX (optional) to show the "Signing out" state
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

  const pathname = usePathname()
  const breadcrumb = useMemo(() => {
    const sectionMap: Array<{ prefix: string; label: string }> = [
      { prefix: '/dashboard/customers', label: 'Clientes' },
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
      { prefix: '/dashboard/whatsapp', label: 'WhatsApp' },
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
        "border-b border-border sticky top-0 z-30 backdrop-blur-sm bg-background/95 supports-backdrop-filter:bg-background/60",
        "transition-[padding,box-shadow,background-color] duration-200",
        isCompact ? "px-4 sm:px-5 py-2 shadow-sm" : "px-6 py-3"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Mobile hamburger + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger menu for mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="lg:hidden p-2"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb + Title */}
          <div className="min-w-0 flex flex-col">
            <div className={cn("text-xs text-muted-foreground hidden sm:block", isCompact && "opacity-80")}>
              Dashboard / {breadcrumb}
            </div>
            <h2 className={cn("font-semibold truncate leading-tight transition-all duration-200", isCompact ? "text-base" : "text-lg")}>
              {breadcrumb}
            </h2>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md hidden md:block">
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-muted-foreground font-normal bg-muted/50 hover:bg-muted border-muted-foreground/10",
              isCompact ? "h-9" : "h-10"
            )}
            onClick={() => setSearchOpen(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Buscar productos, clientes, reparaciones...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 shadow-sm">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </div>

        {/* GlobalSearch Modal */}
        <GlobalSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSearch={search}
        />

        {/* Right side */}
        <div className="flex items-center gap-2">
          <InstallPrompt />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setSearchOpen(true)}>
              <Search className="h-5 w-5" />
            </Button>

            {/* Notifications */}
            <NotificationSystem 
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onDeleteNotification={deleteNotification}
              onClearAll={clearAll}
            />

            {/* Theme Toggle */}
            <ThemeToggle />
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
                  href="/dashboard/settings"
                  className="cursor-pointer py-2.5 px-3 focus:bg-accent focus:text-accent-foreground rounded-md transition-colors mt-1 flex items-center w-full"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary mr-3">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Configuración</span>
                    <span className="text-xs text-muted-foreground">Preferencias de cuenta</span>
                  </div>
                </Link>
              </DropdownMenuItem>
              {user?.role === 'admin' && (
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
