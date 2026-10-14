'use client'

import { memo, useMemo } from 'react'
import Link from 'next/link'
import {
  Banknote,
  FileChartColumn,
  Landmark,
  LayoutDashboard,
  Menu,
  Package,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { NavCategory } from '@/config/admin-navigation'
import type { AdminNavBadges } from '@/hooks/use-admin-nav-badges'
import { cn } from '@/lib/utils'

interface AdminMobileNavProps {
  visibleCategories: NavCategory[]
  pathname: string
  navBadges: AdminNavBadges
  onOpenMenu: () => void
}

interface QuickItemCandidate {
  key: string
  href: string
  mobileLabel: string
  icon: LucideIcon
  badge?: 'cash-alerts'
}

const PREFERRED_CANDIDATES: QuickItemCandidate[] = [
  { key: 'overview', href: '/admin', mobileLabel: 'Resumen', icon: LayoutDashboard },
  { key: 'cash-monitor', href: '/admin/cash-monitor', mobileLabel: 'Cajas', icon: Banknote, badge: 'cash-alerts' },
  { key: 'inventory', href: '/admin/inventory', mobileLabel: 'Stock', icon: Package },
  { key: 'finances', href: '/admin/finances', mobileLabel: 'Finanzas', icon: Landmark },
  { key: 'reports', href: '/admin/reports', mobileLabel: 'Reportes', icon: FileChartColumn },
  { key: 'users', href: '/admin/users', mobileLabel: 'Usuarios', icon: Users },
]

export const AdminMobileNav = memo(function AdminMobileNav({
  visibleCategories,
  pathname,
  navBadges,
  onOpenMenu,
}: AdminMobileNavProps) {
  // Buscar qué items preferidos están permitidos en las categorías visibles
  const quickItems = useMemo(() => {
    const allVisibleItems = visibleCategories.flatMap((cat) => cat.items)
    const visibleHrefs = new Set(allVisibleItems.map((i) => i.href).filter(Boolean))

    const matched = PREFERRED_CANDIDATES.filter((candidate) => visibleHrefs.has(candidate.href))

    // Tomar los primeros 4
    if (matched.length >= 4) {
      return matched.slice(0, 4)
    }

    // Si hay menos de 4, rellenar con otros items visibles que no estén ya
    const usedHrefs = new Set(matched.map((m) => m.href))
    const extras = allVisibleItems
      .filter((item) => item.href && !usedHrefs.has(item.href))
      .map((item) => ({
        key: item.key,
        href: item.href as string,
        mobileLabel: item.label.length > 10 ? item.label.slice(0, 9) + '…' : item.label,
        icon: item.icon,
        badge: item.badge,
      }))

    return [...matched, ...extras].slice(0, 4)
  }, [visibleCategories])

  const totalAlerts = Object.values(navBadges).reduce((acc, curr) => acc + (curr ?? 0), 0)

  return (
    <nav
      aria-label="Navegación móvil inferior"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 shadow-lg backdrop-blur-md supports-backdrop-filter:bg-background/80 lg:hidden"
    >
      <div className="flex items-center justify-around px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {quickItems.map((item) => {
          const isActive = item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href)
          const alertCount = item.badge ? (navBadges[item.badge] ?? 0) : 0

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={`Acceso rápido a ${item.mobileLabel}`}
              className={cn(
                'relative flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all duration-200 active:scale-95',
                isActive
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <item.icon className={cn('h-5 w-5 transition-transform duration-200', isActive && 'scale-110 text-primary')} />
                {alertCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-xs">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </div>
              <span className="max-w-[62px] truncate text-[11px] leading-tight">{item.mobileLabel}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 h-1 w-6 -translate-x-1/2 rounded-t-full bg-primary" aria-hidden="true" />
              )}
            </Link>
          )
        })}

        {/* Botón para abrir el menú completo */}
        <button
          type="button"
          onClick={onOpenMenu}
          className={cn(
            'relative flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-muted-foreground transition-all duration-200 hover:bg-accent/60 hover:text-foreground active:scale-95',
          )}
          aria-label="Abrir menú completo de administración"
        >
          <div className="relative">
            <Menu className="h-5 w-5" />
            {totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-background" aria-hidden="true" />
            )}
          </div>
          <span className="text-[11px] font-medium leading-tight">Menú</span>
        </button>
      </div>
    </nav>
  )
})
