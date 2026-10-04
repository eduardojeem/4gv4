// Force HMR rebuild
'use client'

import { memo, useCallback, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { usePermissions } from '@/hooks/use-permissions'
import { filterDashboardNavGroups, getDashboardNavItemByPath } from '@/config/dashboard-navigation'
import { ACTIVE_REPAIR_STATUSES } from '@/lib/constants/repair-status'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogoutDialog } from '@/components/profile/logout-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  LogOut
} from 'lucide-react'

const DASHBOARD_NAV_STORAGE_KEY = 'dashboard-nav-expanded-groups'

function persistExpandedGroups(groups: string[]) {
  try {
    window.localStorage.setItem(DASHBOARD_NAV_STORAGE_KEY, JSON.stringify(groups))
  } catch {
    // La navegación sigue funcionando si el almacenamiento está bloqueado.
  }
}

export function SidebarToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const label = collapsed ? 'Expandir menú' : 'Contraer menú'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="h-10 w-10 shrink-0 border border-primary/30 bg-primary/10 text-primary shadow-sm hover:border-primary/50 hover:bg-primary/20 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={label}
      title={label}
    >
      {collapsed ? (
        <ChevronRight className="h-5 w-5" />
      ) : (
        <ChevronLeft className="h-5 w-5" />
      )}
    </Button>
  )
}

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarCollapsed: collapsed, toggleSidebar } = useDashboardLayout()
  const { user, signOut } = useAuth()
  const { organizationName, organizationLogoUrl, effectiveModules, businessVertical } = useSubscriptionStatus()
  const [sidebarBadges, setSidebarBadges] = useState({ repairs: 0, lowStock: 0 })
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const { hasPermission } = usePermissions()

  // Read role directly from auth context — single source of truth
  const userRole = user?.role ?? 'vendedor'

  // Load dynamic badge counts
  useEffect(() => {
    if (!config.supabase.isConfigured) return
    const fetchBadges = async () => {
      try {
        const supabase = createClient()
        // Sin sesión las consultas salen como anon y fallan por RLS
        // (permission denied for function has_org_permission).
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const repairsQuery = effectiveModules.includes('repairs')
          ? supabase.from('repairs').select('id', { count: 'exact', head: true }).in('status', [...ACTIVE_REPAIR_STATUSES])
          : Promise.resolve({ count: 0 })
        const [{ count: repairs }, { data: lowStockData }] = await Promise.all([
          repairsQuery,
          supabase.from('products').select('stock_quantity, min_stock').eq('is_active', true)
        ])
        // Incluye agotados (stock 0): también requieren reposición.
        const lowStock = (lowStockData || []).filter(p => Number(p.stock_quantity ?? 0) <= Number(p.min_stock ?? 5)).length
        const nextRepairs = repairs || 0
        // Devolver la misma referencia cuando no cambió nada deja que React
        // no vuelva a renderizar el sidebar cada 5 minutos sin motivo real.
        setSidebarBadges(prev =>
          prev.repairs === nextRepairs && prev.lowStock === lowStock ? prev : { repairs: nextRepairs, lowStock }
        )
      } catch { /* ignore errors */ }
    }
    fetchBadges()
    const interval = setInterval(fetchBadges, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [effectiveModules])

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

  const filteredGroups = useMemo(
    () => filterDashboardNavGroups({ role: userRole, effectiveModules, hasPermission, businessVertical }),
    [userRole, hasPermission, effectiveModules, businessVertical],
  )
  const activeItem = useMemo(() => getDashboardNavItemByPath(pathname), [pathname])
  const activeGroup = useMemo(
    () => filteredGroups.find((group) => group.items.some((item) => item.key === activeItem?.key)),
    [activeItem, filteredGroups],
  )

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((previous) => {
      const next = previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId]
      persistExpandedGroups(next)
      return next
    })
  }, [])

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(DASHBOARD_NAV_STORAGE_KEY) ?? '[]')
      const visibleIds = new Set(filteredGroups.map((group) => group.id))
      const remembered = Array.isArray(stored)
        ? stored.filter((id): id is string => typeof id === 'string' && visibleIds.has(id))
        : []
      const next = activeGroup
        ? Array.from(new Set([...remembered, activeGroup.id]))
        : remembered
      setExpandedGroups(next)
      persistExpandedGroups(next)
    } catch {
      setExpandedGroups(activeGroup ? [activeGroup.id] : [])
    }
  }, [activeGroup, filteredGroups])

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
        collapsed ? 'w-20 -translate-x-full lg:translate-x-0' : 'w-72 translate-x-0'
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center border-b border-border bg-linear-to-r from-primary/5 to-primary/10 shrink-0",
          collapsed ? "justify-center p-3" : "justify-between p-4"
        )}>
          {!collapsed && (
            <div className="flex items-center space-x-3 min-w-0">
              {organizationLogoUrl ? (
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={organizationLogoUrl}
                    alt={organizationName || 'Logo'}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="bg-linear-to-br from-blue-600 to-blue-700 p-2.5 rounded-xl shadow-lg shrink-0">
                  <Smartphone className="h-6 w-6 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-foreground">{organizationName || 'Mi Negocio'}</h1>
                <p className="text-xs text-muted-foreground">Sistema POS</p>
              </div>
            </div>
          )}
          <SidebarToggleButton collapsed={collapsed} onToggle={toggleSidebar} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-5 scroll-smooth">
          {filteredGroups.map(group => {
            const isExpanded = expandedGroups.includes(group.id)
            return (
            <div key={group.id} className="space-y-2">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                  aria-expanded={isExpanded}
                >
                  <span>{group.label}</span>
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
              )}
              {collapsed && <div className="mx-2 h-px bg-border" />}
              {(collapsed || isExpanded) && (
              <div className="space-y-1">
                {group.items.map(item => {
                  const isActive = activeItem?.key === item.key
                  const badge = item.key === 'repairs'
                    ? sidebarBadges.repairs
                    : item.key === 'products'
                      ? sidebarBadges.lowStock
                      : 0
                  return (
                    <Tooltip key={item.key}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          onMouseEnter={() => router.prefetch(item.href)}
                          className={cn(
                            'group relative flex items-center rounded-lg text-sm font-medium transition-colors',
                            collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                            isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={badge > 0 ? `${item.label}: ${badge} pendientes` : item.label}
                        >
                          <span className="relative shrink-0">
                            <item.icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} aria-hidden />
                            {collapsed && badge > 0 && (
                              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-rose-500" aria-hidden />
                            )}
                          </span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!collapsed && badge > 0 && (
                            <span className="ml-auto min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums text-white">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                          {!collapsed && badge === 0 && isActive && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                          )}
                        </Link>
                      </TooltipTrigger>
                      {collapsed && (
                        <TooltipContent side="right" className="max-w-64">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                })}
              </div>
              )}
            </div>
          )})}
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

      {/* Shared logout dialog */}
      <LogoutDialog
        open={logoutOpen}
        loading={isSigningOut}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleQuickLogout}
      />
    </>
  )
})
export default Sidebar
