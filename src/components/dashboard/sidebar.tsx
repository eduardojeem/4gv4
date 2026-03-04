'use client'

import { memo, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'
import { useAuth } from '@/contexts/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  ShoppingCart,
  Wrench,
  UserCheck,
  BarChart3,
  Settings,
  Palette,
  ChevronLeft,
  ChevronRight,
  Activity,
  CreditCard,
  Tag,
  Percent,
  Building2,
  MessageCircle,
  Smartphone,
  LogOut
} from 'lucide-react'


type NavItem = { name: string; href: string; icon: any; roles: Array<'admin' | 'vendedor' | 'tecnico'>; description?: string }
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Principal',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'vendedor', 'tecnico'] },
      { name: 'Punto de Venta', href: '/dashboard/pos', icon: ShoppingCart, roles: ['admin', 'vendedor'] },
      { name: 'Caja', href: '/dashboard/pos/caja', icon: CreditCard, roles: ['admin', 'vendedor'] },
      { name: 'POS Dashboard', href: '/dashboard/pos/dashboard', icon: LayoutDashboard, roles: ['admin', 'vendedor'] },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { name: 'Clientes', href: '/dashboard/customers', icon: Users, roles: ['admin', 'vendedor'] },
      { name: 'Créditos', href: '/dashboard/credits', icon: CreditCard, roles: ['admin', 'vendedor'] },
      { name: 'Productos', href: '/dashboard/products', icon: Package, roles: ['admin', 'vendedor'] },
      { name: 'Marcas', href: '/dashboard/brands', icon: Building2, roles: ['admin'] },
      { name: 'Categorías', href: '/dashboard/categories', icon: Tag, roles: ['admin', 'vendedor'] },
      { name: 'Promociones', href: '/dashboard/promotions', icon: Percent, roles: ['admin', 'vendedor'] },
      { name: 'Proveedores', href: '/dashboard/suppliers', icon: Truck, roles: ['admin'] },
      { name: 'Reparaciones', href: '/dashboard/repairs', icon: Wrench, roles: ['admin', 'vendedor', 'tecnico'] },
      { name: 'Panel Técnico', href: '/dashboard/technician', icon: Activity, roles: ['admin', 'tecnico'], description: 'Operativo para técnicos' },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { name: 'Reportes', href: '/dashboard/reports', icon: BarChart3, roles: ['admin', 'vendedor'] },
      { name: 'WhatsApp', href: '/dashboard/whatsapp', icon: MessageCircle, roles: ['admin', 'vendedor'] },
      { name: 'Administración', href: '/admin', icon: Settings, roles: ['admin'] },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { name: 'Configuración', href: '/dashboard/settings', icon: Palette, roles: ['admin', 'vendedor', 'tecnico'] },
    ],
  },
]

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarCollapsed: collapsed, toggleSidebar, userRole, setUserRole } = useDashboardLayout()
  const { user, signOut } = useAuth()
  const [sidebarBadges, setSidebarBadges] = useState({ repairs: 0, lowStock: 0 })
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  // Load user role from Supabase on mount
  useEffect(() => {
    // Only run on client side and if role is not already set or is default
    if (typeof window === 'undefined') return
    
    const loadRole = async () => {
      try {
        const supabase = createClient()
        // Check session first to avoid unnecessary calls
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return

        const user = session.user
        // Fallback to metadata role if present
        let role = (user?.user_metadata?.role as any) as typeof userRole | undefined
        if (config.supabase.isConfigured && user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          role = (profile?.role as any) || role
        }
        setUserRole((role as any) || 'vendedor')
      } catch {
        // In demo mode or if error, keep default
      }
    }
    loadRole()
  }, [setUserRole])

  // Load dynamic badge counts
  useEffect(() => {
    if (!config.supabase.isConfigured) return
    const fetchBadges = async () => {
      try {
        const supabase = createClient()
        const [{ count: repairs }, { data: lowStockData }] = await Promise.all([
          supabase.from('repairs').select('id', { count: 'exact', head: true }).in('status', ['recibido', 'diagnostico', 'reparacion', 'listo']),
          supabase.from('products').select('stock_quantity, min_stock').gt('stock_quantity', 0)
        ])
        const lowStock = (lowStockData || []).filter(p => Number(p.stock_quantity ?? 0) <= Number(p.min_stock ?? 5)).length
        setSidebarBadges({ repairs: repairs || 0, lowStock })
      } catch { /* ignore errors */ }
    }
    fetchBadges()
    const interval = setInterval(fetchBadges, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleQuickLogout = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      router.push('/login')
    } catch { /* ignore */ } finally {
      setIsSigningOut(false)
      setLogoutOpen(false)
    }
  }

  // Development mode check
  const isDev = process.env.NODE_ENV === 'development'
  
  const filteredGroups = useMemo(() => {
    const filterFn = (item: NavItem) => (isDev ? true : item.roles.includes(userRole as 'admin' | 'vendedor' | 'tecnico'))
    return NAV_GROUPS.map(group => ({
      label: group.label,
      items: group.items.filter(filterFn)
    })).filter(group => group.items.length > 0)
  }, [userRole, isDev])

  return (
    <>
      {/* Mobile Overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={toggleSidebar}
          onKeyDown={(e) => {
            if (e.key === 'Escape') toggleSidebar()
          }}
          role="button"
          tabIndex={0}
          aria-label="Cerrar menú"
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "bg-background border-r border-border flex flex-col transition-all duration-300 z-50",
        "fixed lg:relative inset-y-0 left-0 shadow-2xl lg:shadow-none h-dvh",
        collapsed ? "w-16 -translate-x-full lg:translate-x-0" : "w-72 sm:w-80 translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-linear-to-r from-primary/5 to-primary/10 shrink-0">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="bg-linear-to-br from-blue-600 to-blue-700 p-2.5 rounded-xl shadow-lg">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">4G celulares</h1>
                <p className="text-xs text-muted-foreground">Sistema POS</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2 hover:bg-primary/10"
            aria-label={collapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-4 overflow-y-auto scroll-smooth">
          {filteredGroups.map(group => (
            <div key={group.label} className="space-y-2">
              {!collapsed && (
                <div className="px-3 text-xs uppercase tracking-wide text-muted-foreground/70">
                  {group.label}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map(item => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onMouseEnter={() => router.prefetch(item.href)}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      title={collapsed ? `${item.name}${item.description ? ': ' + item.description : ''}` : undefined}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-primary rounded-r" />
                      )}
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && (
                        <div className="flex items-center gap-2 flex-1">
                          <span>{item.name}</span>
                          {item.href === '/dashboard/pos' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">POS</span>
                          )}
                        </div>
                      )}
                      {!collapsed && item.href === '/dashboard/repairs' && sidebarBadges.repairs > 0 && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">{sidebarBadges.repairs}</span>
                      )}
                      {!collapsed && item.href === '/dashboard/products' && sidebarBadges.lowStock > 0 && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">{sidebarBadges.lowStock}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User info */}
        {!collapsed && (
          <div className="p-4 border-t border-border shrink-0">
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8 border border-border shadow-sm">
                <AvatarImage src={user?.profile?.avatar_url || "/avatars/01.svg"} alt={user?.profile?.name || "Usuario"} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                  {user?.profile?.name ? user.profile.name.substring(0, 2).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.profile?.name || 'Usuario'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {isDev ? 'todos (dev)' : userRole}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                onClick={() => setLogoutOpen(true)}
                disabled={isSigningOut}
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Logout confirmation dialog */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que quieres salir del sistema?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleQuickLogout}
              disabled={isSigningOut}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSigningOut ? 'Cerrando...' : 'Sí, cerrar sesión'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})
export default Sidebar

