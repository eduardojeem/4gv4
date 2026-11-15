'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Banknote,
  ChevronRight,
  FileChartColumn,
  Gauge,
  Grid2X2,
  Landmark,
  LayoutDashboard,
  Menu,
  Package,
  Search,
  Store,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { NavCategory, NavItem } from '@/config/admin-navigation'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import type { AdminNavBadges } from '@/hooks/use-admin-nav-badges'
import { normalizeText } from '@/lib/text/normalize'
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

const COMMAND_FEATURED_KEYS = ['cash-monitor', 'finances'] as const
const COMMAND_MODULE_KEYS = ['users', 'branches', 'website', 'analytics', 'inventory', 'reviews'] as const

type FlatAdminItem = NavItem & { categoryLabel: string }

function isItemActive(pathname: string, href?: string): boolean {
  if (!href) return false
  return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export const AdminMobileNav = memo(function AdminMobileNav({
  visibleCategories,
  pathname,
  navBadges,
  onOpenMenu,
}: AdminMobileNavProps) {
  const { organizationName, organizationLogoUrl, planName } = useSubscriptionStatus()
  const [commandOpen, setCommandOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [previousPathname, setPreviousPathname] = useState(pathname)

  if (previousPathname !== pathname) {
    setPreviousPathname(pathname)
    setCommandOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (!commandOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCommandOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [commandOpen])

  const allFlatItems = useMemo<FlatAdminItem[]>(
    () =>
      visibleCategories.flatMap((category) =>
        category.items.map((item) => ({ ...item, categoryLabel: category.label })),
      ),
    [visibleCategories],
  )

  const itemByKey = useMemo(() => {
    const map = new Map<string, FlatAdminItem>()
    for (const item of allFlatItems) {
      map.set(item.key, item)
    }
    return map
  }, [allFlatItems])

  // Buscar qué items preferidos están permitidos en las categorías visibles
  const quickItems = useMemo(() => {
    const visibleHrefs = new Set(allFlatItems.map((i) => i.href).filter(Boolean))
    const matched = PREFERRED_CANDIDATES.filter((candidate) => visibleHrefs.has(candidate.href))

    if (matched.length >= 4) {
      return matched.slice(0, 4)
    }

    const usedHrefs = new Set(matched.map((m) => m.href))
    const extras = allFlatItems
      .filter((item) => item.href && !usedHrefs.has(item.href))
      .map((item) => ({
        key: item.key,
        href: item.href as string,
        mobileLabel: item.label.length > 10 ? item.label.slice(0, 9) + '…' : item.label,
        icon: item.icon,
        badge: item.badge,
      }))

    return [...matched, ...extras].slice(0, 4)
  }, [allFlatItems])

  const featuredCashItem = itemByKey.get('cash-monitor')
  const featuredFinancesItem = itemByKey.get('finances')

  const moduleItems = useMemo(
    () =>
      COMMAND_MODULE_KEYS.map((key) => itemByKey.get(key)).filter((item): item is FlatAdminItem =>
        Boolean(item),
      ),
    [itemByKey],
  )

  const utilityItems = useMemo(() => {
    const placedKeys = new Set<string>([
      'overview',
      ...COMMAND_FEATURED_KEYS,
      ...COMMAND_MODULE_KEYS,
    ])
    return allFlatItems.filter((item) => !placedKeys.has(item.key))
  }, [allFlatItems])

  const searchResults = useMemo(() => {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []
    return allFlatItems.filter((item) => {
      const haystack = normalizeText(
        `${item.label} ${item.description ?? ''} ${item.categoryLabel} ${item.href ?? ''}`,
      )
      return terms.every((term) => haystack.includes(term))
    })
  }, [allFlatItems, query])

  const totalAlerts = Object.values(navBadges).reduce((acc, curr) => acc + (curr ?? 0), 0)
  const cashAlerts = navBadges['cash-alerts'] ?? 0
  const secondaryActive = !quickItems.some((item) => isItemActive(pathname, item.href))
  const leftItems = quickItems.slice(0, 2)
  const rightItems = quickItems.slice(2, 4)
  const isAdminHome = pathname === '/admin'
  const orgInitial = (organizationName || 'M').trim().charAt(0).toUpperCase()

  const closeCommand = () => {
    setCommandOpen(false)
    setQuery('')
  }

  return (
    <>
      {commandOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <button
            type="button"
            aria-label="Cerrar centro de comando"
            onClick={closeCommand}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] animate-in fade-in duration-150"
          />

          <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-3 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <section
              id="admin-command-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Centro de comando de administración"
              className="w-full max-h-[78dvh] overflow-y-auto rounded-[28px] border border-indigo-500/35 bg-slate-950 p-4 pt-2.5 text-slate-50 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700" />

              {/* Cabecera ejecutiva */}
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-600 text-sm font-black text-white shadow-sm">
                  {organizationLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={organizationLogoUrl}
                      alt={organizationName || 'Comercio'}
                      className="h-full w-full bg-white object-contain p-0.5"
                    />
                  ) : (
                    <span>{orgInitial}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] font-black tracking-tight text-slate-50">
                    Centro de Comando
                  </h2>
                  <p className="truncate text-[11.5px] font-semibold text-slate-400">
                    {organizationName || 'Administración'}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-extrabold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Admin{planName ? ` · ${planName}` : ''}
                </span>
              </div>

              {/* Acceso principal destacado: Volver al Panel / Inicio */}
              <Link
                href="/dashboard"
                onClick={closeCommand}
                className="mb-2.5 flex items-center gap-3 rounded-2xl border-2 border-cyan-400 bg-indigo-50 px-3 py-2.5 text-slate-950 shadow-[0_4px_18px_rgba(56,189,248,0.28)] transition-transform active:scale-[0.99]"
              >
                <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black tracking-tight text-slate-950">
                    Volver al Panel / Inicio
                  </p>
                  <p className="truncate text-[11.5px] font-semibold text-slate-700">
                    Ir a ventas, POS y operación diaria
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-950 px-2.5 py-1.5 text-[11.5px] font-extrabold text-white">
                  Ir al Panel
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>

              {/* Accesos rápidos secundarios arriba */}
              <div className="mb-3 flex items-center gap-2">
                {!isAdminHome && (
                  <Link
                    href="/admin"
                    onClick={closeCommand}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-800"
                  >
                    <Gauge className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Inicio Admin</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    closeCommand()
                    onOpenMenu()
                  }}
                  aria-label="Abrir menú lateral completo"
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-800"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Menu className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
                    <span className="truncate">Ver menú lateral completo</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </button>
              </div>

              {/* Buscador de módulos */}
              <div className="mb-3 flex h-10.5 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar módulo (cajas, usuarios, web, seguridad…)"
                  aria-label="Buscar módulo de administración"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
                {query.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="rounded-full p-0.5 text-slate-400 hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {query.trim().length > 0 ? (
                <div className="space-y-1.5">
                  {searchResults.length === 0 ? (
                    <p className="py-5 text-center text-xs font-medium text-slate-400">
                      No encontramos esa sección. Probá con otro nombre.
                    </p>
                  ) : (
                    searchResults.map((item) => {
                      const active = isItemActive(pathname, item.href)
                      const badgeCount = item.badge ? (navBadges[item.badge] ?? 0) : 0
                      return (
                        <Link
                          key={item.key}
                          href={item.href || '#'}
                          onClick={closeCommand}
                          className={cn(
                            'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                            active
                              ? 'border-indigo-400 bg-indigo-600/25'
                              : 'border-slate-800 bg-slate-900/90 hover:border-slate-700 hover:bg-slate-800/90',
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                              active ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-cyan-300',
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-extrabold text-slate-100">
                                {item.label}
                              </span>
                              {badgeCount > 0 && (
                                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                                  {badgeCount}
                                </span>
                              )}
                            </div>
                            <p className="truncate text-[11px] text-slate-400">
                              {item.categoryLabel}
                              {item.description ? ` · ${item.description}` : ''}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                        </Link>
                      )
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Tarjetas en vivo: Cajas + Finanzas */}
                  {(featuredCashItem || featuredFinancesItem) && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {featuredCashItem && (
                        <Link
                          href={featuredCashItem.href || '/admin/cash-monitor'}
                          onClick={closeCommand}
                          className="flex flex-col gap-1 rounded-[18px] border border-cyan-400/45 bg-slate-900 p-3 transition-transform active:scale-[0.98]"
                        >
                          <div className="mb-1 flex items-center justify-between gap-1.5">
                            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                              <featuredCashItem.icon className="h-4.5 w-4.5" />
                            </div>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
                                cashAlerts > 0
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300',
                              )}
                            >
                              {cashAlerts > 0 ? `${cashAlerts} alertas` : 'En vivo'}
                            </span>
                          </div>
                          <p className="truncate text-[13.5px] font-extrabold tracking-tight text-slate-50">
                            Monitor de Cajas
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {cashAlerts > 0 ? 'Requiere atención' : 'Control en tiempo real'}
                          </p>
                        </Link>
                      )}

                      {featuredFinancesItem && (
                        <Link
                          href={featuredFinancesItem.href || '/admin/finances'}
                          onClick={closeCommand}
                          className="flex flex-col gap-1 rounded-[18px] border border-indigo-400/45 bg-slate-900 p-3 transition-transform active:scale-[0.98]"
                        >
                          <div className="mb-1 flex items-center justify-between gap-1.5">
                            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                              <featuredFinancesItem.icon className="h-4.5 w-4.5" />
                            </div>
                            <ArrowRight className="h-4 w-4 text-indigo-300" />
                          </div>
                          <p className="truncate text-[13.5px] font-extrabold tracking-tight text-slate-50">
                            Finanzas y Flujo
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            Ingresos, gastos y caja
                          </p>
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Grilla de módulos del comercio */}
                  {moduleItems.length > 0 && (
                    <div>
                      <p className="mb-2 px-0.5 text-[10.5px] font-extrabold tracking-wider text-slate-400">
                        MÓDULOS DEL COMERCIO
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {moduleItems.map((item) => {
                          const active = isItemActive(pathname, item.href)
                          return (
                            <Link
                              key={item.key}
                              href={item.href || '#'}
                              onClick={closeCommand}
                              className={cn(
                                'flex flex-col gap-1.5 rounded-2xl border px-2.5 py-2.5 transition-colors active:scale-[0.98]',
                                active
                                  ? 'border-indigo-400 bg-indigo-600 text-white'
                                  : 'border-slate-800 bg-slate-900 text-slate-100 hover:border-slate-700',
                              )}
                            >
                              <item.icon
                                className={cn('h-4.5 w-4.5', active ? 'text-white' : 'text-indigo-300')}
                              />
                              <span className="truncate text-xs font-bold">{item.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Chips de sistema, facturación y ayuda */}
                  {utilityItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {utilityItems.map((item) => {
                        const active = isItemActive(pathname, item.href)
                        return (
                          <Link
                            key={item.key}
                            href={item.href || '#'}
                            onClick={closeCommand}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors',
                              active
                                ? 'border-indigo-400 bg-indigo-600 text-white'
                                : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700',
                            )}
                          >
                            <item.icon
                              className={cn('h-3.5 w-3.5', active ? 'text-white' : 'text-slate-300')}
                            />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Botón central X squircle (cierre del Centro de Comando) */}
            <button
              type="button"
              onClick={closeCommand}
              aria-label="Cerrar centro de comando"
              className="flex h-14 w-14 items-center justify-center rounded-[20px] border-2 border-indigo-400 bg-slate-950 text-white shadow-xl shadow-indigo-950/60 transition-transform active:scale-95"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegación móvil inferior"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-indigo-500/35 bg-slate-950/95 text-slate-100 shadow-[0_-8px_30px_rgba(2,6,23,0.45)] backdrop-blur-xl lg:hidden"
      >
        <div className="grid grid-cols-5 items-end px-1.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {leftItems.map((item) => (
            <DockLink
              key={item.key}
              item={item}
              active={!commandOpen && isItemActive(pathname, item.href)}
              alertCount={item.badge ? (navBadges[item.badge] ?? 0) : 0}
            />
          ))}

          {/* Botón central squircle del Centro de Comando Admin */}
          <div className="col-start-3 flex flex-col items-center justify-end gap-0.5 pb-1">
            <button
              type="button"
              onClick={() => setCommandOpen((prev) => !prev)}
              aria-label={
                commandOpen
                  ? 'Cerrar centro de comando de administración'
                  : 'Abrir centro de comando de administración'
              }
              aria-expanded={commandOpen}
              aria-controls="admin-command-menu"
              className={cn(
                'relative -mt-5 flex h-13 w-13 items-center justify-center rounded-[19px] border-2 text-white shadow-lg transition-all active:scale-95',
                commandOpen || secondaryActive
                  ? 'border-cyan-400 bg-indigo-600 shadow-indigo-500/40'
                  : 'border-slate-800 bg-indigo-600 shadow-indigo-950/60',
              )}
            >
              <Grid2X2 className="h-6 w-6" />
              {totalAlerts > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950"
                  aria-hidden="true"
                />
              )}
            </button>
            <span
              className={cn(
                'text-[10px] font-extrabold leading-tight',
                commandOpen || secondaryActive ? 'text-cyan-300' : 'text-slate-300',
              )}
            >
              Comando
            </span>
          </div>

          {rightItems.map((item, idx) => (
            <div key={item.key} className={idx === 0 ? 'col-start-4' : 'col-start-5'}>
              <DockLink
                item={item}
                active={!commandOpen && isItemActive(pathname, item.href)}
                alertCount={item.badge ? (navBadges[item.badge] ?? 0) : 0}
              />
            </div>
          ))}
        </div>
      </nav>
    </>
  )
})

function DockLink({
  item,
  active,
  alertCount,
}: {
  item: QuickItemCandidate
  active: boolean
  alertCount: number
}) {
  return (
    <Link
      href={item.href}
      aria-label={`Acceso rápido a ${item.mobileLabel}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 transition-all duration-200 active:scale-95',
        active ? 'bg-indigo-500/20 font-bold text-slate-50' : 'text-slate-400 hover:text-slate-100',
      )}
    >
      <div className="relative">
        <item.icon
          className={cn(
            'h-5 w-5 transition-transform duration-200',
            active ? 'scale-105 text-cyan-300' : 'text-slate-400',
          )}
        />
        {alertCount > 0 && (
          <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-slate-950 shadow-xs">
            {alertCount > 99 ? '99+' : alertCount}
          </span>
        )}
      </div>
      <span className="max-w-[62px] truncate text-[10.5px] leading-tight">{item.mobileLabel}</span>
      {active && (
        <span
          className="absolute bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-cyan-300"
          aria-hidden="true"
        />
      )}
    </Link>
  )
}
