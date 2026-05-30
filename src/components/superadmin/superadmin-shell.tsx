'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  BarChart3,
  Banknote,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Crown,
  FileText,
  Globe,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Sparkles,
  Store,
  Users,
  Wrench,
  Bug,
  Database,
  LogOut,
  UserCheck,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

type NavSection = 'overview' | 'tenants' | 'billing' | 'content' | 'system'

type NavChild = {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

type NavItem = NavChild & {
  section: NavSection
  badge?: string
  children?: NavChild[]
}

const sectionLabels: Record<NavSection, string> = {
  overview: 'Visión general',
  tenants: 'Tenants',
  billing: 'Facturación',
  content: 'Contenido web',
  system: 'Sistema',
}

const sectionOrder: NavSection[] = ['overview', 'tenants', 'billing', 'content', 'system']

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/superadmin',
    icon: BarChart3,
    description: 'Métricas globales del sistema',
    section: 'overview',
  },
  {
    title: 'Analíticas',
    href: '/superadmin/analytics',
    icon: Activity,
    description: 'Crecimiento, ingresos y actividad SaaS',
    section: 'overview',
  },
  {
    title: 'Métricas SaaS',
    href: '/superadmin/saas-metrics',
    icon: Database,
    description: 'Uso, consumo y salud comercial',
    section: 'overview',
  },
  {
    title: 'Organizaciones',
    href: '/superadmin/organizations',
    icon: Building2,
    description: 'Clientes y tenants del sistema',
    section: 'tenants',
    children: [
      { title: 'Todas las organizaciones', href: '/superadmin/organizations', icon: Building2 },
      { title: 'Nueva organización', href: '/superadmin/organizations/create', icon: Sparkles },
      { title: 'Configuración tenants', href: '/superadmin/organizations/settings', icon: Settings },
    ],
  },
  {
    title: 'Usuarios',
    href: '/superadmin/users',
    icon: Users,
    description: 'Usuarios de todo el sistema',
    section: 'tenants',
    children: [
      { title: 'Todos los usuarios', href: '/superadmin/users', icon: Users },
      { title: 'Super admins', href: '/superadmin/users/super-admins', icon: Crown },
    ],
  },
  {
    title: 'Planes',
    href: '/superadmin/plans',
    icon: Sparkles,
    badge: 'SaaS',
    description: 'Planes, límites y paquetes',
    section: 'billing',
  },
  {
    title: 'Suscripciones',
    href: '/superadmin/subscriptions',
    icon: CreditCard,
    description: 'Suscripciones activas por tenant',
    section: 'billing',
  },
  {
    title: 'Facturas',
    href: '/superadmin/invoices',
    icon: FileText,
    description: 'Historial de facturación',
    section: 'billing',
  },
  {
    title: 'Facturación',
    href: '/superadmin/billing',
    icon: Banknote,
    description: 'Resumen de billing',
    section: 'billing',
  },
  {
    title: 'Contenido web',
    href: '/superadmin/web-content',
    icon: Globe,
    description: 'Páginas públicas del sistema SaaS',
    section: 'content',
    children: [
      { title: 'Contenido general', href: '/superadmin/web-content', icon: Globe },
      { title: 'Landing', href: '/superadmin/web-content/landing', icon: LayoutTemplate },
      { title: 'Marketplace', href: '/superadmin/web-content/marketplace', icon: Store },
    ],
  },
  {
    title: 'Monitoreo',
    href: '/superadmin/monitoring',
    icon: Activity,
    badge: 'Live',
    description: 'Salud, rendimiento y conexiones',
    section: 'system',
    children: [
      { title: 'Vista general', href: '/superadmin/monitoring', icon: Activity },
      { title: 'Base de datos', href: '/superadmin/database-monitoring', icon: Database },
    ],
  },
  {
    title: 'Audit Logs',
    href: '/superadmin/audit-logs',
    icon: Shield,
    description: 'Registro de auditoría y trazabilidad',
    section: 'system',
  },
  {
    title: 'Emails',
    href: '/superadmin/emails',
    icon: Mail,
    description: 'Plantillas transaccionales',
    section: 'system',
  },
  {
    title: 'Configuración',
    href: '/superadmin/settings',
    icon: Settings,
    description: 'Parámetros globales del sistema',
    section: 'system',
  },
  {
    title: 'Mantenimiento',
    href: '/superadmin/maintenance',
    icon: Wrench,
    children: [
      { title: 'Tareas globales', href: '/superadmin/maintenance', icon: Wrench },
      { title: 'Storage cleanup', href: '/superadmin/storage-cleanup', icon: Trash2 },
    ],
    description: 'Caché, sesiones y purga de logs',
    section: 'system',
  },
  {
    title: 'Diagnóstico',
    href: '/superadmin/diagnostic',
    icon: Bug,
    description: 'Pruebas rápidas de APIs y permisos',
    section: 'system',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isItemActive(pathname: string, item: NavChild) {
  if (item.href === '/superadmin') return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function getActiveItem(pathname: string) {
  const allItems = navItems.flatMap((item) => [item, ...(item.children ?? [])])
  return allItems
    .filter((item) => isItemActive(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

/** Build breadcrumb segments from pathname */
function getBreadcrumbs(pathname: string): { title: string; href: string }[] {
  const segments: { title: string; href: string }[] = []

  // Find parent if active item is a child
  const active = getActiveItem(pathname)
  if (!active) return segments

  const parent = navItems.find(
    (item) => item.children?.some((child) => child.href === active.href)
  )

  if (parent && parent.href !== active.href) {
    segments.push({ title: parent.title, href: parent.href })
  }

  if (active) {
    segments.push({ title: active.title, href: active.href })
  }

  return segments
}

// ---------------------------------------------------------------------------
// SidebarContent — extracted as a standalone component to avoid remount on
// every render of SuperAdminShell (was previously defined inside render).
// ---------------------------------------------------------------------------

type SidebarContentProps = {
  mode: 'desktop' | 'mobile'
  pathname: string
  isCollapsed: boolean
  expandedItems: Set<string>
  userDisplayName: string
  onCollapse: () => void
  onExpand: () => void
  onToggleExpanded: (title: string) => void
  onNavigate: (href: string) => void
  onLogout: () => void
}

function SidebarContent({
  mode,
  pathname,
  isCollapsed,
  expandedItems,
  userDisplayName,
  onCollapse,
  onExpand,
  onToggleExpanded,
  onNavigate,
  onLogout,
}: SidebarContentProps) {
  const collapsed = mode === 'desktop' && isCollapsed

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-950">
      {/* Logo / brand */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-800">
        <Link
          href="/superadmin"
          className={cn('flex min-w-0 items-center gap-2.5', collapsed && 'mx-auto')}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950">
            <Crown className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-slate-950 dark:text-slate-50">
                MiPOS
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">Super Admin</p>
            </div>
          )}
        </Link>

        {mode === 'desktop' && !collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={onCollapse}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Colapsar menú</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-5">
          {sectionOrder.map((section) => {
            const items = navItems.filter((item) => item.section === section)
            if (!items.length) return null

            return (
              <div key={section} className="space-y-0.5">
                {!collapsed && (
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {sectionLabels[section]}
                  </p>
                )}

                {items.map((item) => {
                  const isActive =
                    isItemActive(pathname, item) ||
                    Boolean(item.children?.some((child) => isItemActive(pathname, child)))
                  const isExpanded = expandedItems.has(item.title)
                  const Icon = item.icon
                  const hasChildren = Boolean(item.children?.length)

                  // Items with children: clicking the label toggles expand/collapse,
                  // clicking the chevron also toggles. In collapsed mode, clicking
                  // navigates directly (no expand possible).
                  const navButton = (
                    <div key={item.href} className="flex items-center gap-0.5">
                      {/* Main nav link — always navigates */}
                      <Link
                        href={item.href}
                        onClick={() => onNavigate(item.href)}
                        className={cn(
                          'group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors',
                          collapsed ? 'justify-center' : 'justify-start',
                          isActive
                            ? 'bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        )}
                        {!collapsed && item.badge && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'h-5 shrink-0 rounded px-1.5 text-[10px]',
                              isActive
                                ? 'border-white/30 text-white dark:border-slate-950/30 dark:text-slate-950'
                                : ''
                            )}
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>

                      {/* Expand/collapse toggle — only shown when not collapsed and has children */}
                      {!collapsed && hasChildren && (
                        <button
                          type="button"
                          aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                          onClick={() => onToggleExpanded(item.title)}
                          className={cn(
                            'flex h-9 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                            isActive
                              ? 'text-white/70 hover:bg-slate-800 dark:text-slate-950/70 dark:hover:bg-slate-300'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                          )}
                        >
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 transition-transform duration-200',
                              isExpanded && 'rotate-180'
                            )}
                          />
                        </button>
                      )}
                    </div>
                  )

                  return (
                    <div key={item.href}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              onClick={() => onNavigate(item.href)}
                              className={cn(
                                'flex h-9 w-full items-center justify-center rounded-md transition-colors',
                                isActive
                                  ? 'bg-slate-950 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">{item.title}</TooltipContent>
                        </Tooltip>
                      ) : (
                        navButton
                      )}

                      {/* Children */}
                      {!collapsed && hasChildren && isExpanded && (
                        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
                          {item.children!.map((child) => {
                            const ChildIcon = child.icon
                            const childActive = isItemActive(pathname, child)
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => onNavigate(child.href)}
                                className={cn(
                                  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] transition-colors',
                                  childActive
                                    ? 'bg-slate-100 font-medium text-slate-950 dark:bg-slate-800 dark:text-slate-50'
                                    : 'font-normal text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                                )}
                              >
                                <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{child.title}</span>
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        {!collapsed ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-800/60">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                {userDisplayName}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <Crown className="h-2.5 w-2.5" />
                Super Admin
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onLogout}
                  className="h-8 w-8 shrink-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Cerrar sesión</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onExpand}
                  aria-label="Expandir menú"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menú</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onLogout}
                  className="h-9 w-9 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Cerrar sesión</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Breadcrumb component for the topbar
// ---------------------------------------------------------------------------

function Breadcrumb({ pathname }: { pathname: string }) {
  const crumbs = getBreadcrumbs(pathname)

  if (crumbs.length === 0) {
    return (
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Super Admin</span>
    )
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
      <Link
        href="/superadmin"
        className="shrink-0 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
      >
        SA
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />
          {i === crumbs.length - 1 ? (
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
              {crumb.title}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="truncate text-xs text-slate-500 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
            >
              {crumb.title}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Main shell export
// ---------------------------------------------------------------------------

export function SuperAdminShell({
  children,
  userEmail,
}: {
  children: React.ReactNode
  userEmail: string | null
}) {
  const pathname = usePathname() ?? '/superadmin'
  const router = useRouter()
  const { signOut, user } = useAuth()

  // Start with empty set — localStorage hydration happens in useEffect to
  // avoid flash of wrong state (previously hardcoded 3 items caused a 1-frame
  // flicker when user had collapsed them).
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Hydrate from localStorage once on mount
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCollapsed(window.localStorage.getItem('sa_sidebar_collapsed') === '1')
      const stored = window.localStorage.getItem('sa_sidebar_expanded')
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          setExpandedItems(new Set(parsed.filter((v): v is string => typeof v === 'string')))
        }
      } else {
        // First visit — expand sensible defaults
        setExpandedItems(new Set(['Organizaciones', 'Usuarios', 'Contenido web', 'Monitoreo', 'Mantenimiento']))
      }
    } catch {
      setExpandedItems(new Set(['Organizaciones', 'Usuarios', 'Contenido web', 'Monitoreo', 'Mantenimiento']))
    }
  }, [])

  // Persist collapsed state
  useEffect(() => {
    try {
      window.localStorage.setItem('sa_sidebar_collapsed', isCollapsed ? '1' : '0')
    } catch { /* optional */ }
  }, [isCollapsed])

  // Persist expanded items
  useEffect(() => {
    try {
      window.localStorage.setItem('sa_sidebar_expanded', JSON.stringify(Array.from(expandedItems)))
    } catch { /* optional */ }
  }, [expandedItems])

  // Auto-expand parent when navigating to a child route
  useEffect(() => {
    const parents = navItems
      .filter((item) => item.children?.some((child) => isItemActive(pathname, child)))
      .map((item) => item.title)
    if (!parents.length) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedItems((current) => {
      const next = new Set(current)
      parents.forEach((p) => next.add(p))
      return next
    })
  }, [pathname])

  const activeItem = useMemo(() => getActiveItem(pathname), [pathname])
  const activeBadge = (activeItem as NavItem | undefined)?.badge ?? null
  const userDisplayName = user?.profile?.name || userEmail || 'Super admin'

  const handleLogout = useCallback(async () => {
    await signOut()
    router.push('/login')
  }, [signOut, router])

  const handleToggleExpanded = useCallback((title: string) => {
    setExpandedItems((current) => {
      const next = new Set(current)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }, [])

  // Close mobile sheet on navigation
  const handleNavigate = useCallback(() => {
    setMobileOpen(false)
  }, [])

  const sidebarProps: Omit<SidebarContentProps, 'mode'> = {
    pathname,
    isCollapsed,
    expandedItems,
    userDisplayName,
    onCollapse: () => setIsCollapsed(true),
    onExpand: () => setIsCollapsed(false),
    onToggleExpanded: handleToggleExpanded,
    onNavigate: handleNavigate,
    onLogout: handleLogout,
  }

  return (
    <TooltipProvider>
      {/* h-dvh: respects dynamic viewport on iOS Safari (avoids content cut by address bar) */}
      <div className="flex h-dvh overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">

        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden shrink-0 border-r border-slate-200 transition-[width] duration-200 dark:border-slate-800 md:flex md:flex-col',
            isCollapsed ? 'w-[60px]' : 'w-64'
          )}
        >
          <SidebarContent mode="desktop" {...sidebarProps} />
        </aside>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Topbar */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-w-0 items-center gap-2">

              {/* Expand sidebar button (desktop, collapsed state) */}
              {isCollapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden h-9 w-9 text-slate-500 md:flex"
                      onClick={() => setIsCollapsed(false)}
                      aria-label="Expandir menú"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Expandir menú</TooltipContent>
                </Tooltip>
              )}

              {/* Mobile hamburger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 md:hidden"
                    aria-label="Abrir menú"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Menú Super Admin</SheetTitle>
                  </SheetHeader>
                  <SidebarContent mode="mobile" {...sidebarProps} />
                </SheetContent>
              </Sheet>

              {/* Breadcrumb — replaces the redundant title/description pair */}
              <div className="min-w-0">
                <Breadcrumb pathname={pathname} />
                {activeBadge && (
                  <Badge
                    variant="outline"
                    className="mt-0.5 hidden h-4 rounded border-slate-200 px-1.5 text-[10px] text-slate-500 sm:inline-flex dark:border-slate-700 dark:text-slate-400"
                  >
                    {activeBadge}
                  </Badge>
                )}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 md:flex">
                <Button asChild variant="outline" size="sm" className="h-9 gap-2">
                  <Link href="/admin">
                    <Shield className="h-4 w-4" />
                    Admin
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-9 gap-2">
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              </div>

              {/* Mobile icon-only buttons */}
              <div className="flex items-center gap-1 md:hidden">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="outline" size="icon" className="h-9 w-9" aria-label="Ir a Admin">
                      <Link href="/admin">
                        <Shield className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Ir a Admin</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="outline" size="icon" className="h-9 w-9" aria-label="Ir a Dashboard">
                      <Link href="/dashboard">
                        <LayoutDashboard className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Ir a Dashboard</TooltipContent>
                </Tooltip>
              </div>

              <Separator orientation="vertical" className="hidden h-5 sm:block" />
              <ThemeToggle />
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-x-auto overflow-y-auto">
            <div className="min-w-0 p-4 sm:p-6">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
