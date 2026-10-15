'use client'

import { memo, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Crown,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Shield,
  Store,
  X,
} from 'lucide-react'
import { SubscriptionChip } from '@/components/admin/SubscriptionChip'
import { BranchSelector } from '@/components/branches/branch-selector'
import { OrganizationSwitcher } from '@/components/saas/organization-switcher'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { NavCategory } from '@/config/admin-navigation'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import type { AdminNavBadges } from '@/hooks/use-admin-nav-badges'
import { cn } from '@/lib/utils'

interface AdminMobileDrawerProps {
  open: boolean
  onClose: () => void
  visibleCategories: NavCategory[]
  expandedCategories: string[]
  onToggleCategory: (categoryId: string) => void
  pathname: string
  navBadges: AdminNavBadges
  onOpenSearch: () => void
  onOpenLogout: () => void
  user: any
  userInitials: string
}

export const AdminMobileDrawer = memo(function AdminMobileDrawer({
  open,
  onClose,
  visibleCategories,
  expandedCategories,
  onToggleCategory,
  pathname,
  navBadges,
  onOpenSearch,
  onOpenLogout,
  user,
  userInitials,
}: AdminMobileDrawerProps) {
  const { organizationName, organizationLogoUrl } = useSubscriptionStatus()

  // Bloquear el scroll del body mientras el menú esté abierto
  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop con blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel lateral deslizante */}
      <aside
        aria-label="Menú móvil de administración"
        className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[340px] flex-col border-r border-border bg-card text-card-foreground shadow-2xl transition-transform duration-300 ease-out"
      >
        {/* Encabezado del menú móvil */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4 shrink-0 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0">
            {organizationLogoUrl ? (
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-border bg-white p-0.5 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={organizationLogoUrl}
                  alt={organizationName || 'Logo'}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold text-foreground">
                {organizationName || 'Administración'}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Shield className="h-3 w-3 text-primary" /> Panel de Control
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Buscador rápido integrado */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenSearch()
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border/80 bg-muted/50 px-3 py-2 text-left text-xs text-muted-foreground transition-all duration-150 hover:border-border hover:bg-muted active:scale-[0.99]"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 font-medium truncate">Buscar sección o herramienta...</span>
            <kbd className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              Buscar
            </kbd>
          </button>
        </div>

        {/* Selector de organización y sucursal en móvil */}
        <div className="space-y-1.5 border-b border-border/80 px-3 pb-3 shrink-0">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ubicación y Sucursal
          </p>
          <div className="flex flex-col gap-1.5">
            <OrganizationSwitcher compact />
            <BranchSelector compact />
          </div>
        </div>

        {/* Lista de navegación scrolleable */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3 scroll-smooth">
          {visibleCategories.map((category) => {
            const isExpanded = expandedCategories.includes(category.id)

            return (
              <div key={category.id} className="space-y-1">
                {/* Título de categoría como acordeón interactivo */}
                <button
                  type="button"
                  onClick={() => onToggleCategory(category.id)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  aria-expanded={isExpanded}
                >
                  <span>{category.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-normal text-muted-foreground/70">
                      ({category.items.length})
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-1 pl-1">
                    {category.items.map(({ key, label, icon: Icon, description, href, badge }) => {
                      const isActive =
                        href === '/admin' ? pathname === href : pathname.startsWith(href || '')
                      const alertCount = badge ? (navBadges[badge] ?? 0) : 0

                      return (
                        <Link
                          key={key}
                          href={href || '#'}
                          onClick={onClose}
                          className={cn(
                            'group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-all duration-150 active:scale-[0.98]',
                            isActive
                              ? 'bg-primary/15 font-semibold text-primary border border-primary/20 shadow-2xs'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <div
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'bg-muted/80 text-muted-foreground group-hover:bg-muted group-hover:text-foreground',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="truncate text-xs font-medium text-foreground">
                                {label}
                              </span>
                              {alertCount > 0 && (
                                <span className="min-w-4 rounded-full bg-rose-500 px-1.5 py-0.2 text-center text-[10px] font-bold text-white shadow-xs">
                                  {alertCount > 99 ? '99+' : alertCount}
                                </span>
                              )}
                            </div>
                            {description && (
                              <p className="truncate text-[10px] text-muted-foreground">
                                {description}
                              </p>
                            )}
                          </div>

                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100',
                              isActive && 'text-primary opacity-100',
                            )}
                          />
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Accesos directos y enlaces clave */}
        <div className="space-y-2 border-t border-border bg-muted/20 px-3 py-2.5 shrink-0">
          <SubscriptionChip variant="sidebar" />

          {/* Botón rápido para volver al POS / Dashboard */}
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-accent"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate leading-tight">Ir a Tienda / POS</p>
              <p className="truncate text-[10px] font-normal text-muted-foreground">
                Volver a la operativa diaria
              </p>
            </div>
            <ArrowLeft className="h-3.5 w-3.5 rotate-180 text-muted-foreground" />
          </Link>

          {/* Enlaces de ayuda y superadmin si corresponde */}
          <div className="grid grid-cols-2 gap-1.5">
            <Link
              href="/admin/guia"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>Guía</span>
            </Link>

            {user?.role === 'super_admin' ? (
              <Link
                href="/superadmin"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-purple-200/60 bg-purple-50/50 px-2.5 py-1.5 text-[11px] font-medium text-purple-700 hover:bg-purple-100/60 dark:border-purple-800/40 dark:bg-purple-950/20 dark:text-purple-300"
              >
                <Crown className="h-3.5 w-3.5" />
                <span>Super Admin</span>
              </Link>
            ) : (
              <Link
                href="/admin/settings"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Ajustes</span>
              </Link>
            )}
          </div>
        </div>

        {/* Ficha de usuario y cierre de sesión */}
        <div className="border-t border-border bg-card px-3 py-2.5 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8 border border-border shadow-2xs shrink-0">
                <AvatarImage
                  src={user?.profile?.avatar_url || '/avatars/01.svg'}
                  alt={user?.profile?.name || 'Usuario'}
                />
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {user?.profile?.name || 'Usuario'}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {user?.email || 'admin@sistema.com'}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onClose()
                onOpenLogout()
              }}
              className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </div>
  )
})
