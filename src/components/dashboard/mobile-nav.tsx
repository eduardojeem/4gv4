'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowRight,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  KeyRound,
  LayoutGrid,
  Menu,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { usePermissions } from '@/hooks/use-permissions'
import {
  filterDashboardNavGroups,
  getBusinessFocusSection,
  getDashboardNavItemByPath,
  getMobileDashboardItems,
  type DashboardNavGroup,
  type DashboardNavItem,
} from '@/config/dashboard-navigation'
import { normalizeText } from '@/lib/text/normalize'
import { cn } from '@/lib/utils'

const MAX_PINNED_SHORTCUTS = 4

const DASHBOARD_GRID_PRIORITY = [
  'pos',
  'cash-register',
  'repairs',
  'orders',
  'agenda',
  'products',
  'customers',
  'credits',
  'promotions',
  'quotes',
  'inventory-count',
  'pos-analytics',
  'expirations',
  'suppliers',
  'after-sales',
  'categories',
  'brands',
  'repair-inventory',
  'technician',
] as const

const GRID_PRIORITY_INDEX = new Map<string, number>(
  DASHBOARD_GRID_PRIORITY.map((key, index) => [key, index]),
)

const DASHBOARD_TILE_SHORT_LABELS: Record<string, string> = {
  overview: 'Inicio',
  pos: 'POS',
  'cash-register': 'Caja',
  repairs: 'Taller',
  agenda: 'Agenda',
  orders: 'Pedidos',
  products: 'Productos',
  customers: 'Clientes',
  credits: 'Créditos',
  promotions: 'Promos',
  quotes: 'Presup.',
  'inventory-count': 'Stock',
  expirations: 'Vencim.',
  suppliers: 'Proveed.',
  'after-sales': 'Posventa',
  'pos-analytics': 'Analítica',
  categories: 'Categ.',
  brands: 'Marcas',
  'repair-inventory': 'Repuestos',
  technician: 'Técnico',
  administration: 'Admin',
  'action:new-repair': '+ Repar.',
  'action:open-cash': 'Abrir caja',
  'action:new-sale': '+ Venta',
  'action:new-order': '+ Pedido',
  'action:new-reservation': '+ Turno',
}

const TINTED_TILE_CLASSES = [
  {
    tile: 'border-emerald-200/90 bg-emerald-50 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-500/15 dark:text-emerald-300',
    icon: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    tile: 'border-blue-200/90 bg-blue-50 text-blue-700 dark:border-blue-400/35 dark:bg-blue-600/20 dark:text-blue-300',
    icon: 'text-blue-700 dark:text-blue-300',
  },
  {
    tile: 'border-cyan-200/90 bg-cyan-50 text-cyan-700 dark:border-cyan-400/35 dark:bg-cyan-500/15 dark:text-cyan-300',
    icon: 'text-cyan-700 dark:text-cyan-300',
  },
  {
    tile: 'border-violet-200/90 bg-violet-50 text-violet-700 dark:border-violet-400/35 dark:bg-violet-500/15 dark:text-violet-300',
    icon: 'text-violet-700 dark:text-violet-300',
  },
] as const

const NEUTRAL_TILE_CLASS = {
  tile: 'border-slate-200/90 bg-slate-50 text-slate-800 hover:bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100',
  icon: 'text-slate-800 dark:text-slate-200',
}

const QUICK_ACTION_TILE_CLASS = {
  tile: 'border-blue-200/80 bg-blue-50/70 text-blue-800 hover:bg-blue-100/70 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-200',
  icon: 'text-blue-700 dark:text-blue-300',
}

type ShortcutKind = 'section' | 'action'

type DashboardShortcut = {
  key: string
  kind: ShortcutKind
  label: string
  shortLabel: string
  href: string
  icon: LucideIcon
  description: string
  groupLabel: string
}

function dashboardStorageKey(organizationId?: string | null) {
  return organizationId ? `panel_pinned_shortcuts_v1.${organizationId}` : 'panel_pinned_shortcuts_v1'
}

function readStoredShortcutKeys(storageKey: string): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : null
  } catch {
    return null
  }
}

function writeStoredShortcutKeys(storageKey: string, keys: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(keys))
  } catch {
    // Continuar aunque el navegador bloquee almacenamiento local.
  }
}

function resolveDashboardPinnedKeys(
  savedKeys: readonly string[] | null | undefined,
  available: readonly DashboardShortcut[],
  defaultSections: readonly DashboardShortcut[],
): string[] {
  const valid = new Set(available.map((item) => item.key))
  const resolved: string[] = []

  for (const key of savedKeys ?? []) {
    if (valid.has(key) && !resolved.includes(key)) {
      resolved.push(key)
      if (resolved.length >= MAX_PINNED_SHORTCUTS) return resolved
    }
  }

  for (const fallback of [...defaultSections, ...available]) {
    if (!resolved.includes(fallback.key)) {
      resolved.push(fallback.key)
      if (resolved.length >= MAX_PINNED_SHORTCUTS) break
    }
  }

  return resolved
}

function toggleDashboardPinnedKey(currentKeys: readonly string[], key: string): string[] {
  if (currentKeys.includes(key)) {
    return currentKeys.filter((item) => item !== key)
  }
  if (currentKeys.length < MAX_PINNED_SHORTCUTS) {
    return [...currentKeys, key]
  }
  return [...currentKeys.slice(1), key]
}

function buildDashboardQuickActions({
  groups,
  userRole,
  hasPermission,
}: {
  groups: DashboardNavGroup[]
  userRole: string | undefined
  hasPermission: (permission: string) => boolean
}): DashboardShortcut[] {
  const sectionKeys = new Set(groups.flatMap((group) => group.items.map((item) => item.key)))
  const isAdminRole = userRole === 'admin' || userRole === 'super_admin'
  const actions: DashboardShortcut[] = []

  if (
    sectionKeys.has('repairs') &&
    (isAdminRole ||
      hasPermission('repairs.manage') ||
      hasPermission('repairs.create') ||
      hasPermission('repairs.orders.create'))
  ) {
    actions.push({
      key: 'action:new-repair',
      kind: 'action',
      label: 'Nueva reparación',
      shortLabel: DASHBOARD_TILE_SHORT_LABELS['action:new-repair'],
      href: '/dashboard/repairs?new=true',
      icon: Wrench,
      description: 'Cargar orden al taller',
      groupLabel: 'Acción rápida',
    })
  }

  if (sectionKeys.has('cash-register')) {
    actions.push({
      key: 'action:open-cash',
      kind: 'action',
      label: 'Abrir caja',
      shortLabel: DASHBOARD_TILE_SHORT_LABELS['action:open-cash'],
      href: '/dashboard/pos/caja',
      icon: KeyRound,
      description: 'Iniciar o revisar turno de caja',
      groupLabel: 'Acción rápida',
    })
  }

  if (sectionKeys.has('pos') && (isAdminRole || hasPermission('pos.read') || hasPermission('pos.sales.create'))) {
    actions.push({
      key: 'action:new-sale',
      kind: 'action',
      label: 'Nueva venta',
      shortLabel: DASHBOARD_TILE_SHORT_LABELS['action:new-sale'],
      href: '/dashboard/pos',
      icon: ShoppingCart,
      description: 'Cobrar en el punto de venta',
      groupLabel: 'Acción rápida',
    })
  }

  if (
    sectionKeys.has('orders') &&
    (isAdminRole ||
      hasPermission('orders.manage') ||
      hasPermission('ecommerce.orders.manage') ||
      hasPermission('orders.read'))
  ) {
    actions.push({
      key: 'action:new-order',
      kind: 'action',
      label: 'Nuevo pedido',
      shortLabel: DASHBOARD_TILE_SHORT_LABELS['action:new-order'],
      href: '/dashboard/orders/new',
      icon: PackagePlus,
      description: 'Crear pedido o envío',
      groupLabel: 'Acción rápida',
    })
  }

  if (sectionKeys.has('agenda')) {
    actions.push({
      key: 'action:new-reservation',
      kind: 'action',
      label: 'Nueva reserva',
      shortLabel: DASHBOARD_TILE_SHORT_LABELS['action:new-reservation'],
      href: '/dashboard/agenda',
      icon: CalendarPlus,
      description: 'Agendar turno en la agenda',
      groupLabel: 'Acción rápida',
    })
  }

  return actions
}

export const MobileNav = memo(function MobileNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { toggleSidebar } = useDashboardLayout()
  const activeOrg = useOptionalActiveOrganization()
  const {
    effectiveModules,
    businessVertical,
    operatingModel,
    primaryActivity,
    organizationName,
    organizationLogoUrl,
  } = useSubscriptionStatus()
  const { hasPermission } = usePermissions()
  const userRole = user?.role

  const storageKey = dashboardStorageKey(activeOrg?.organization?.id)

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [savedState, setSavedState] = useState<{ key: string; values: string[] | null }>({
    key: storageKey,
    values: null,
  })
  const [previousPathname, setPreviousPathname] = useState(pathname)

  if (previousPathname !== pathname) {
    setPreviousPathname(pathname)
    setMenuOpen(false)
    setSearchOpen(false)
    setEditing(false)
    setShowAll(false)
    setQuery('')
  }

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setSavedState({
        key: storageKey,
        values: readStoredShortcutKeys(storageKey),
      })
    })
    return () => {
      active = false
    }
  }, [storageKey])

  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setSearchOpen(false)
        setEditing(false)
        setShowAll(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const {
    filteredItems,
    administrationItem,
    sectionShortcuts,
    quickActions,
    allSelectable,
    allSearchable,
  } = useMemo(() => {
    const groups = filterDashboardNavGroups({
      role: userRole,
      effectiveModules,
      hasPermission,
      businessVertical,
      operatingModel,
    })
    const mobileItems = getMobileDashboardItems(groups, 4, businessVertical,operatingModel,primaryActivity)
    const flatWithGroups = groups.flatMap((group) =>
      group.items.map((item) => ({ ...item, groupLabel: group.label })),
    )
    const adminItem = flatWithGroups.find((item) => item.key === 'administration')
    const seen = new Set<string>()
    const rawGrid = flatWithGroups.filter((item) => {
      if (item.key === 'overview' || item.key === 'administration') return false
      if (seen.has(item.key)) return false
      seen.add(item.key)
      return true
    })
    const focus = getBusinessFocusSection(groups, businessVertical,operatingModel)
    const rankOf = (key: string) => {
      if (focus === 'agenda' && key === 'agenda') return 1.5
      return GRID_PRIORITY_INDEX.get(key) ?? Number.MAX_SAFE_INTEGER
    }
    const sortedSections: DashboardShortcut[] = [...rawGrid]
      .sort((a, b) => rankOf(a.key) - rankOf(b.key))
      .map((item) => ({
        key: item.key,
        kind: 'section',
        label: item.label,
        shortLabel: DASHBOARD_TILE_SHORT_LABELS[item.key] ?? item.mobileLabel ?? item.label,
        href: item.href,
        icon: item.icon,
        description: item.description,
        groupLabel: item.groupLabel,
      }))

    const actions = buildDashboardQuickActions({ groups, userRole, hasPermission })
    const fullSearchable: DashboardShortcut[] = [
      ...actions,
      ...flatWithGroups.map((item) => ({
        key: item.key,
        kind: 'section' as const,
        label: item.label,
        shortLabel: DASHBOARD_TILE_SHORT_LABELS[item.key] ?? item.mobileLabel ?? item.label,
        href: item.href,
        icon: item.icon,
        description: item.description,
        groupLabel: item.groupLabel,
      })),
    ]

    return {
      filteredItems: mobileItems,
      administrationItem: adminItem,
      sectionShortcuts: sortedSections,
      quickActions: actions,
      allSelectable: [...sortedSections, ...actions],
      allSearchable: fullSearchable,
    }
  }, [userRole, effectiveModules, hasPermission, businessVertical, operatingModel, primaryActivity])

  const activeItem = useMemo(() => getDashboardNavItemByPath(pathname), [pathname])
  const savedKeys = savedState.key === storageKey ? savedState.values : null

  const validKeySet = useMemo(() => new Set(allSelectable.map((item) => item.key)), [allSelectable])
  const shortcutByKey = useMemo(
    () => new Map(allSelectable.map((item) => [item.key, item])),
    [allSelectable],
  )

  const effectivePinnedKeys = useMemo(
    () => resolveDashboardPinnedKeys(savedKeys, allSelectable, sectionShortcuts),
    [savedKeys, allSelectable, sectionShortcuts],
  )

  const editSelectedKeys = useMemo(() => {
    if (savedKeys === null) return effectivePinnedKeys
    return savedKeys.filter((key) => validKeySet.has(key)).slice(0, MAX_PINNED_SHORTCUTS)
  }, [savedKeys, effectivePinnedKeys, validKeySet])

  const activePinnedKeys = editing ? editSelectedKeys : effectivePinnedKeys
  const pinnedItems = useMemo(
    () =>
      activePinnedKeys
        .map((key) => shortcutByKey.get(key))
        .filter((item): item is DashboardShortcut => Boolean(item)),
    [activePinnedKeys, shortcutByKey],
  )

  const pinnedSet = useMemo(() => new Set(activePinnedKeys), [activePinnedKeys])
  const remainingSections = useMemo(
    () => sectionShortcuts.filter((item) => !pinnedSet.has(item.key)),
    [sectionShortcuts, pinnedSet],
  )
  const extraCount = remainingSections.length + quickActions.length

  const searchResults = useMemo(() => {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []
    return allSearchable.filter((item) => {
      const haystack = normalizeText(
        `${item.label} ${item.shortLabel} ${item.description} ${item.groupLabel} ${item.href}`,
      )
      return terms.every((term) => haystack.includes(term))
    })
  }, [allSearchable, query])

  // El POS tiene su propia barra inferior («Cobrar»): las dos iban en el mismo
  // lugar y esta, por estar después en la página, tapaba el botón de cobro.
  if (pathname === '/dashboard/pos') return null

  const closeMenu = () => {
    setMenuOpen(false)
    setSearchOpen(false)
    setEditing(false)
    setShowAll(false)
    setQuery('')
  }

  const persistPinnedKeys = (nextKeys: string[]) => {
    const clean = nextKeys.slice(0, MAX_PINNED_SHORTCUTS)
    setSavedState({ key: storageKey, values: clean })
    writeStoredShortcutKeys(storageKey, clean)
  }

  const handleTogglePin = (key: string) => {
    const current = savedKeys === null ? effectivePinnedKeys : editSelectedKeys
    persistPinnedKeys(toggleDashboardPinnedKey(current, key))
  }

  const handleFinishEditing = () => {
    if (editSelectedKeys.length === 0) {
      persistPinnedKeys(resolveDashboardPinnedKeys([], allSelectable, sectionShortcuts))
    }
    setEditing(false)
  }

  const leftItems = filteredItems.slice(0, 2)
  const rightItems = filteredItems.slice(2, 4)
  const dockHasActive = filteredItems.some((item) => activeItem?.key === item.key)
  const centerActive = menuOpen || (Boolean(activeItem) && !dockHasActive)
  const orgInitial = (organizationName || 'M').trim().charAt(0).toUpperCase()

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú rápido del panel"
            onClick={closeMenu}
            className="animate-in fade-in duration-150 absolute inset-0 bg-slate-950/35 backdrop-blur-[2px] dark:bg-slate-950/70"
          />

          <div className="relative z-10 mx-auto flex w-full max-w-[392px] flex-col items-center gap-2.5 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <section
              id="dashboard-quick-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Centro de control del panel"
              className={cn(
                'animate-in slide-in-from-bottom-4 fade-in duration-200 flex w-full flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white px-3 pt-2 pb-3 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
                editing || showAll ? 'max-h-[74dvh]' : 'max-h-[64dvh]',
              )}
            >
              <div className="mx-auto mb-2 h-[3.5px] w-8 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />

              {/* Cabecera limpia en 1 fila */}
              <div className="mb-2.5 flex shrink-0 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-blue-600 text-[13px] font-black text-white">
                  {organizationLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={organizationLogoUrl}
                      alt={organizationName || 'Mi Negocio'}
                      className="h-full w-full bg-white object-cover"
                    />
                  ) : (
                    <span>{orgInitial}</span>
                  )}
                </div>

                <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold tracking-tight">
                  {organizationName || 'Mi Negocio'}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setSearchOpen((prev) => {
                      if (prev) setQuery('')
                      return !prev
                    })
                  }}
                  aria-label={searchOpen ? 'Cerrar buscador de secciones' : 'Buscar sección'}
                  aria-expanded={searchOpen}
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
                    searchOpen
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200',
                  )}
                >
                  {searchOpen ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    closeMenu()
                    toggleSidebar()
                  }}
                  aria-label="Abrir menú lateral completo"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Menu className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Buscador compacto opcional */}
              {searchOpen && (
                <div className="mb-2.5 flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-2.5 focus-within:border-blue-600 dark:border-slate-700 dark:bg-slate-800">
                  <Search className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar sección o acción (reparación, caja, venta…)"
                    aria-label="Buscar sección del panel"
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400"
                  />
                  {query.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Limpiar búsqueda"
                      className="rounded-full p-0.5 text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                {searchOpen && query.trim().length > 0 ? (
                  <div className="space-y-1.5">
                    {searchResults.length === 0 ? (
                      <p className="py-4 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                        No encontramos esa sección ni acción rápida.
                      </p>
                    ) : (
                      searchResults.map((item) => {
                        const active = item.kind === 'section' && activeItem?.key === item.key
                        return (
                          <Link
                            key={item.key}
                            href={item.href}
                            onClick={closeMenu}
                            className={cn(
                              'flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors',
                              active
                                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-600/20 dark:text-blue-200'
                                : 'border-transparent bg-slate-100/90 text-slate-900 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-100',
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-xs font-bold">
                              {item.label}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              {item.groupLabel}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          </Link>
                        )
                      })
                    )}
                  </div>
                ) : editing ? (
                  /* ── MODO CAMBIAR 4 PRINCIPALES ── */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-extrabold text-blue-600 dark:text-blue-300">
                        Elegí 4 accesos principales ({editSelectedKeys.length}/4)
                      </span>
                      <button
                        type="button"
                        onClick={handleFinishEditing}
                        aria-label="Guardar accesos principales"
                        className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10.5px] font-extrabold text-white transition-opacity hover:opacity-90"
                      >
                        <span>Listo</span>
                        <Check className="h-3 w-3" />
                      </button>
                    </div>

                    <p className="text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                      TU BARRA PRINCIPAL (TOCA PARA QUITAR)
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {pinnedItems.map((item, index) => {
                        const tone = TINTED_TILE_CLASSES[index] ?? NEUTRAL_TILE_CLASS
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleTogglePin(item.key)}
                            aria-label={`Quitar ${item.label} de principales`}
                            className={cn(
                              'relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1 text-center transition-all active:scale-95',
                              tone.tile,
                            )}
                          >
                            <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current/25 bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-300">
                              <X className="h-2.5 w-2.5" />
                            </span>
                            <item.icon className={cn('h-4 w-4 shrink-0', tone.icon)} />
                            <span className="w-full truncate text-[9.5px] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                              {item.shortLabel}
                            </span>
                          </button>
                        )
                      })}
                      {Array.from({
                        length: Math.max(0, MAX_PINNED_SHORTCUTS - pinnedItems.length),
                      }).map((_, slotIdx) => (
                        <div
                          key={`slot-${slotIdx}`}
                          className="flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] border border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span className="text-[9.5px] font-bold">Libre</span>
                        </div>
                      ))}
                    </div>

                    {quickActions.length > 0 && (
                      <>
                        <p className="pt-1 text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                          ACCIONES RÁPIDAS (PARA AGREGAR)
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {quickActions.map((item) => {
                            const selected = pinnedSet.has(item.key)
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => handleTogglePin(item.key)}
                                aria-label={
                                  selected
                                    ? `Quitar ${item.label}`
                                    : `Agregar ${item.label} a principales`
                                }
                                aria-pressed={selected}
                                className={cn(
                                  'relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1 text-center transition-all active:scale-95',
                                  QUICK_ACTION_TILE_CLASS.tile,
                                  selected &&
                                    'border-blue-600 ring-1 ring-blue-600 dark:border-blue-400 dark:ring-blue-400',
                                )}
                              >
                                <span
                                  className={cn(
                                    'absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full',
                                    selected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
                                  )}
                                >
                                  {selected ? (
                                    <Check className="h-2.5 w-2.5" />
                                  ) : (
                                    <Plus className="h-2.5 w-2.5" />
                                  )}
                                </span>
                                <item.icon
                                  className={cn('h-4 w-4 shrink-0', QUICK_ACTION_TILE_CLASS.icon)}
                                />
                                <span className="w-full truncate text-[9.5px] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                                  {item.shortLabel}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}

                    {sectionShortcuts.length > 0 && (
                      <>
                        <p className="pt-1 text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                          SECCIONES DEL PANEL
                        </p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {sectionShortcuts.map((item) => {
                            const selected = pinnedSet.has(item.key)
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => handleTogglePin(item.key)}
                                aria-label={
                                  selected
                                    ? `Quitar ${item.label}`
                                    : `Agregar ${item.label} a principales`
                                }
                                aria-pressed={selected}
                                className={cn(
                                  'relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1 text-center transition-all active:scale-95',
                                  NEUTRAL_TILE_CLASS.tile,
                                  selected &&
                                    'border-blue-600 ring-1 ring-blue-600 dark:border-blue-400 dark:ring-blue-400',
                                )}
                              >
                                <span
                                  className={cn(
                                    'absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full',
                                    selected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
                                  )}
                                >
                                  {selected ? (
                                    <Check className="h-2.5 w-2.5" />
                                  ) : (
                                    <Plus className="h-2.5 w-2.5" />
                                  )}
                                </span>
                                <item.icon
                                  className={cn('h-4 w-4 shrink-0', NEUTRAL_TILE_CLASS.icon)}
                                />
                                <span className="w-full truncate text-[9.5px] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                                  {item.shortLabel}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* ── VISTA PRINCIPAL LIMPIA (4 PRINCIPALES + CAMBIAR) ── */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                        PRINCIPALES ({pinnedItems.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAll(false)
                          setEditing(true)
                        }}
                        aria-label="Cambiar accesos principales"
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10.5px] font-extrabold text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-600/20 dark:text-blue-300"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        <span>Cambiar</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {pinnedItems.map((item, index) => {
                        const active = item.kind === 'section' && activeItem?.key === item.key
                        const tone = TINTED_TILE_CLASSES[index] ?? NEUTRAL_TILE_CLASS
                        return (
                          <Link
                            key={item.key}
                            href={item.href}
                            onClick={closeMenu}
                            aria-label={item.label}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1 text-center transition-all active:scale-95',
                              tone.tile,
                              active &&
                                'border-blue-600 ring-1 ring-blue-600 dark:border-blue-400 dark:ring-blue-400',
                            )}
                          >
                            <item.icon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                active ? 'text-blue-600 dark:text-blue-400' : tone.icon,
                              )}
                            />
                            <span
                              className={cn(
                                'w-full truncate text-[9.5px] font-bold leading-tight tracking-tight',
                                active
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-slate-900 dark:text-slate-100',
                              )}
                            >
                              {item.shortLabel}
                            </span>
                          </Link>
                        )
                      })}
                    </div>

                    {extraCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAll((prev) => !prev)}
                        aria-expanded={showAll}
                        aria-label={
                          showAll
                            ? 'Ocultar secciones y acciones rápidas'
                            : `Ver todas las secciones (${extraCount})`
                        }
                        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span>
                          {showAll ? 'Ocultar secciones' : `Ver todas las secciones (${extraCount})`}
                        </span>
                        {showAll ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}

                    {showAll && (
                      <div className="space-y-2 pt-1">
                        {quickActions.length > 0 && (
                          <>
                            <p className="text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                              ACCIONES RÁPIDAS
                            </p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {quickActions.map((item) => (
                                <Link
                                  key={item.key}
                                  href={item.href}
                                  onClick={closeMenu}
                                  aria-label={item.label}
                                  className={cn(
                                    'flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1 text-center transition-all active:scale-95',
                                    QUICK_ACTION_TILE_CLASS.tile,
                                  )}
                                >
                                  <item.icon
                                    className={cn('h-4 w-4 shrink-0', QUICK_ACTION_TILE_CLASS.icon)}
                                  />
                                  <span className="w-full truncate text-[9.5px] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                                    {item.shortLabel}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </>
                        )}

                        {remainingSections.length > 0 && (
                          <>
                            <p className="pt-1 text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                              MÁS SECCIONES
                            </p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {remainingSections.map((item) => {
                                const active = activeItem?.key === item.key
                                return (
                                  <Link
                                    key={item.key}
                                    href={item.href}
                                    onClick={closeMenu}
                                    aria-label={item.label}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                      'flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] border px-1 text-center transition-all active:scale-95',
                                      NEUTRAL_TILE_CLASS.tile,
                                      active &&
                                        'border-blue-600 ring-1 ring-blue-600 dark:border-blue-400 dark:ring-blue-400',
                                    )}
                                  >
                                    <item.icon
                                      className={cn(
                                        'h-4 w-4 shrink-0',
                                        active
                                          ? 'text-blue-600 dark:text-blue-400'
                                          : NEUTRAL_TILE_CLASS.icon,
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        'w-full truncate text-[9.5px] font-bold leading-tight tracking-tight',
                                        active
                                          ? 'text-blue-600 dark:text-blue-400'
                                          : 'text-slate-900 dark:text-slate-100',
                                      )}
                                    >
                                      {item.shortLabel}
                                    </span>
                                  </Link>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botón mejorado Ir a Administración (fijo y destacado abajo) */}
              {administrationItem && (
                <div className="mt-2.5 shrink-0 border-t border-slate-200/80 pt-2.5 dark:border-slate-800">
                  <Link
                    href={administrationItem.href}
                    onClick={closeMenu}
                    aria-label="Ir a Administración"
                    className="flex items-center gap-2.5 rounded-2xl bg-[#1E1B4B] px-3 py-2 text-white shadow-sm transition-transform active:scale-[0.985]"
                  >
                    <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-[10px] border border-cyan-400/30 bg-cyan-400/15 text-cyan-300">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-extrabold leading-tight tracking-tight text-white">
                        Ir a Administración
                      </p>
                      <p className="truncate text-[10px] font-semibold text-indigo-200/90">
                        Configuración, cajas y finanzas
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-400 px-2.5 py-1 text-[10.5px] font-black text-slate-950">
                      Ir
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                </div>
              )}
            </section>

            {/* Botón circular Cobalto de cierre X */}
            <button
              type="button"
              onClick={closeMenu}
              aria-label="Cerrar menú rápido del panel"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/35 transition-transform active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegación móvil del panel"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur-md supports-backdrop-filter:bg-background/85 lg:hidden"
      >
        <div className="grid grid-cols-5 items-end px-1.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {leftItems.map((item) => (
            <DashboardDockLink
              key={item.key}
              item={item}
              active={!menuOpen && activeItem?.key === item.key}
            />
          ))}

          {/* Botón central elevado del Centro de Control */}
          <div className="col-start-3 flex flex-col items-center justify-end gap-0.5 pb-1">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={menuOpen ? 'Cerrar menú rápido del panel' : 'Abrir menú rápido del panel'}
              aria-expanded={menuOpen}
              aria-controls="dashboard-quick-menu"
              className={cn(
                'flex h-12 w-12 -mt-4 items-center justify-center rounded-[18px] border-2 bg-blue-600 text-white shadow-md transition-all active:scale-95',
                centerActive
                  ? 'border-blue-200 shadow-blue-600/35 dark:border-blue-300'
                  : 'border-background shadow-slate-900/20',
              )}
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
            <span
              className={cn(
                'text-[10px] font-bold leading-none',
                centerActive ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground',
              )}
            >
              Menú
            </span>
          </div>

          {rightItems.map((item, idx) => (
            <div key={item.key} className={idx === 0 ? 'col-start-4' : 'col-start-5'}>
              <DashboardDockLink
                item={item}
                active={!menuOpen && activeItem?.key === item.key}
              />
            </div>
          ))}
        </div>
      </nav>
    </>
  )
})

function DashboardDockLink({
  item,
  active,
}: {
  item: DashboardNavItem
  active: boolean
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 transition-all duration-200 active:scale-95',
        active
          ? 'bg-primary/10 font-bold text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <item.icon
        className={cn('h-5 w-5 transition-transform', active && 'scale-105')}
      />
      <span className="max-w-14 truncate text-[10px] font-medium leading-none">
        {item.mobileLabel ?? item.label}
      </span>
      {active && (
        <span
          className="absolute bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
    </Link>
  )
}
