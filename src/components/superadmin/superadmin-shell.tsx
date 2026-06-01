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
  Database,
  FileText,
  Globe,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Sparkles,
  Store,
  Trash2,
  Users,
  Wrench,
  Bug,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Nav definition
// ---------------------------------------------------------------------------

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

const sectionMeta: Record<NavSection, { label: string; color: string }> = {
  overview: { label: 'Visión general', color: 'text-sky-400' },
  tenants:  { label: 'Tenants',        color: 'text-blue-400' },
  billing:  { label: 'Facturación',    color: 'text-emerald-400' },
  content:  { label: 'Contenido web',  color: 'text-violet-400' },
  system:   { label: 'Sistema',        color: 'text-orange-400' },
}

const sectionOrder: NavSection[] = ['overview', 'tenants', 'billing', 'content', 'system']

const navItems: NavItem[] = [
  { title: 'Dashboard',     href: '/superadmin',              icon: BarChart3,  description: 'Métricas globales del sistema',            section: 'overview' },
  { title: 'Analíticas',    href: '/superadmin/analytics',    icon: Activity,   description: 'Crecimiento, ingresos y actividad SaaS',   section: 'overview' },
  { title: 'Métricas SaaS', href: '/superadmin/saas-metrics', icon: Database,   description: 'Uso, consumo y salud comercial',           section: 'overview' },

  {
    title: 'Organizaciones', href: '/superadmin/organizations', icon: Building2, description: 'Clientes y tenants del sistema', section: 'tenants',
    children: [
      { title: 'Todas las organizaciones', href: '/superadmin/organizations',          icon: Building2 },
      { title: 'Nueva organización',       href: '/superadmin/organizations/create',  icon: Sparkles },
      { title: 'Configuración tenants',    href: '/superadmin/organizations/settings', icon: Settings },
    ],
  },
  {
    title: 'Usuarios', href: '/superadmin/users', icon: Users, description: 'Usuarios de todo el sistema', section: 'tenants',
    children: [
      { title: 'Todos los usuarios', href: '/superadmin/users',             icon: Users },
      { title: 'Super admins',       href: '/superadmin/users/super-admins', icon: Crown },
    ],
  },

  { title: 'Planes',              href: '/superadmin/plans',         icon: Sparkles,      badge: 'SaaS', description: 'Planes, límites y paquetes',          section: 'billing' },
  { title: 'Suscripciones',       href: '/superadmin/subscriptions', icon: CreditCard,                  description: 'Suscripciones activas por tenant',    section: 'billing' },
  { title: 'Historial de pagos',  href: '/superadmin/invoices',      icon: FileText,                    description: 'Comprobantes y pagos recibidos',      section: 'billing' },
  { title: 'Resumen financiero',  href: '/superadmin/billing',       icon: Banknote,                    description: 'MRR, ARR y métricas de ingresos',     section: 'billing' },

  {
    title: 'Contenido web', href: '/superadmin/web-content', icon: Globe, description: 'Páginas públicas del sistema SaaS', section: 'content',
    children: [
      { title: 'Contenido general', href: '/superadmin/web-content',            icon: Globe },
      { title: 'Landing',           href: '/superadmin/web-content/landing',    icon: LayoutTemplate },
      { title: 'Marketplace',       href: '/superadmin/web-content/marketplace', icon: Store },
    ],
  },

  {
    title: 'Monitoreo', href: '/superadmin/monitoring', icon: Activity, badge: 'Live', description: 'Salud, rendimiento y conexiones', section: 'system',
    children: [
      { title: 'Vista general',  href: '/superadmin/monitoring',            icon: Activity },
      { title: 'Base de datos',  href: '/superadmin/database-monitoring',   icon: Database },
    ],
  },
  { title: 'Audit Logs',    href: '/superadmin/audit-logs', icon: Shield,   description: 'Registro de auditoría y trazabilidad', section: 'system' },
  { title: 'Emails',        href: '/superadmin/emails',     icon: Mail,     description: 'Plantillas transaccionales',           section: 'system' },
  { title: 'Configuración', href: '/superadmin/settings',   icon: Settings, description: 'Parámetros globales del sistema',      section: 'system' },
  {
    title: 'Mantenimiento', href: '/superadmin/maintenance', icon: Wrench, description: 'Caché, sesiones y purga de logs', section: 'system',
    children: [
      { title: 'Tareas globales',  href: '/superadmin/maintenance',     icon: Wrench },
      { title: 'Storage cleanup',  href: '/superadmin/storage-cleanup', icon: Trash2 },
    ],
  },
  { title: 'Diagnóstico', href: '/superadmin/diagnostic', icon: Bug, description: 'Pruebas rápidas de APIs y permisos', section: 'system' },
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

function getBreadcrumbs(pathname: string): { title: string; href: string }[] {
  const active = getActiveItem(pathname)
  if (!active) return []

  const parent = navItems.find((item) => item.children?.some((child) => child.href === active.href))
  const segments: { title: string; href: string }[] = []

  if (parent && parent.href !== active.href) segments.push({ title: parent.title, href: parent.href })
  segments.push({ title: active.title, href: active.href })

  return segments
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

// ---------------------------------------------------------------------------
// Individual child link
// ---------------------------------------------------------------------------

function ChildLink({ child, pathname, isLast }: { child: NavChild; pathname: string; isLast: boolean }) {
  const ChildIcon = child.icon
  const active = isItemActive(pathname, child)

  return (
    <div className="relative flex items-stretch">
      {/* Tree line: vertical stem + horizontal branch */}
      <div className="relative mr-3 flex w-3 shrink-0 flex-col items-center">
        <div className="w-px flex-1 bg-white/10" />
        {isLast && <div className="w-px flex-1" />}
        <div className="absolute top-[14px] h-px w-3 bg-white/10" />
      </div>

      <Link
        href={child.href}
        className={cn(
          'group my-0.5 flex h-8 flex-1 items-center gap-2 rounded-md px-2.5 text-[13px] transition-all duration-150',
          active
            ? 'bg-white/10 font-semibold text-white ring-1 ring-white/10'
            : 'font-normal text-slate-500 hover:bg-white/5 hover:text-slate-200'
        )}
      >
        <ChildIcon className={cn('h-3.5 w-3.5 shrink-0 transition-colors', active ? 'text-white' : 'text-slate-600 group-hover:text-slate-300')} />
        <span className="truncate">{child.title}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />}
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nav item (leaf or parent-with-children)
// ---------------------------------------------------------------------------

function NavItemRow({
  item,
  collapsed,
  isActive,
  isExpanded,
  sectionColor,
  pathname,
  onToggleExpanded,
}: {
  item: NavItem
  collapsed: boolean
  isActive: boolean
  isExpanded: boolean
  sectionColor: string
  pathname: string
  onToggleExpanded: (title: string) => void
}) {
  const Icon = item.icon
  const hasChildren = Boolean(item.children?.length)

  // ── Collapsed mode: icon-only with tooltip ──────────────────────────────
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              'relative flex h-9 w-full items-center justify-center rounded-lg transition-all duration-150',
              isActive ? 'bg-white/10 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
            )}
          >
            <Icon className={cn('h-4 w-4', isActive ? sectionColor : '')} />
            {isActive && <span className="absolute left-0 h-5 w-0.5 rounded-r bg-white/50" />}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.title}
          {item.badge && <Badge variant="secondary" className="h-4 rounded px-1 text-[10px]">{item.badge}</Badge>}
          {hasChildren && <span className="text-slate-400">· {item.children!.length} subs</span>}
        </TooltipContent>
      </Tooltip>
    )
  }

  // ── Expanded mode ────────────────────────────────────────────────────────
  return (
    <div>
      {/* Parent row */}
      <div className="relative flex items-center gap-0.5">
        {isActive && !hasChildren && <span className="absolute -left-3 h-6 w-0.5 rounded-r bg-white/40" />}
        <Link
          href={item.href}
          className={cn(
            'group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-all duration-150',
            isActive && !hasChildren
              ? 'bg-white/10 text-white'
              : hasChildren && isExpanded
              ? 'text-slate-200 hover:text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
          )}
        >
          <div className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
            isActive || (hasChildren && isExpanded) ? `bg-white/10 ${sectionColor}` : 'bg-white/5 text-slate-500 group-hover:text-slate-300'
          )}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {item.badge && (
            <Badge
              variant="outline"
              className={cn(
                'ml-auto h-4 shrink-0 rounded border-white/20 px-1.5 text-[10px] font-medium',
                isActive ? 'border-white/30 text-white/70' : 'text-slate-600'
              )}
            >
              {item.badge}
            </Badge>
          )}
        </Link>

        {/* Expand/collapse for parent items */}
        {hasChildren && (
          <button
            type="button"
            aria-label={isExpanded ? 'Colapsar sección' : 'Expandir sección'}
            onClick={() => onToggleExpanded(item.title)}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white/5 hover:text-slate-300'
            )}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-250', isExpanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Children tree */}
      {hasChildren && isExpanded && (
        <div className="ml-2 mt-1">
          {item.children!.map((child, idx) => (
            <ChildLink
              key={child.href}
              child={child}
              pathname={pathname}
              isLast={idx === item.children!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SidebarContent
// ---------------------------------------------------------------------------

type SidebarContentProps = {
  mode: 'desktop' | 'mobile'
  pathname: string
  isCollapsed: boolean
  expandedItems: Set<string>
  userDisplayName: string
  userEmail: string | null
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
  userEmail,
  onCollapse,
  onExpand,
  onToggleExpanded,
  onNavigate,
  onLogout,
}: SidebarContentProps) {
  const collapsed = mode === 'desktop' && isCollapsed

  return (
    <div className="flex h-full flex-col bg-slate-900">
      {/* Brand */}
      <div className={cn('flex h-16 shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center px-3' : 'justify-between px-4')}>
        <Link href="/superadmin" className={cn('flex min-w-0 items-center gap-3', collapsed && 'mx-auto')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 shadow-lg shadow-indigo-500/30">
            <Crown className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-white">MiPOS</p>
              <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-indigo-400">
                Super Admin
              </p>
            </div>
          )}
        </Link>

        {mode === 'desktop' && !collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                onClick={onCollapse}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Colapsar</TooltipContent>
          </Tooltip>
        )}

        {mode === 'mobile' && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-white/5" onClick={() => onNavigate('')}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className={cn('space-y-1', collapsed ? 'px-2' : 'px-3')}>
          {sectionOrder.map((section) => {
            const items = navItems.filter((item) => item.section === section)
            if (!items.length) return null
            const { label, color } = sectionMeta[section]

            const sectionHasActive = items.some(
              (item) => isItemActive(pathname, item) || item.children?.some((c) => isItemActive(pathname, c))
            )

            return (
              <div key={section}>
                {/* Section header */}
                {!collapsed ? (
                  <div className={cn(
                    'mb-1 mt-3 flex items-center gap-2 rounded-md px-2 py-1',
                    sectionHasActive ? 'bg-white/5' : ''
                  )}>
                    <div className={cn('h-1.5 w-1.5 rounded-full', color.replace('text-', 'bg-'))} />
                    <span className={cn('text-[10px] font-bold uppercase tracking-[0.2em]', color)}>
                      {label}
                    </span>
                  </div>
                ) : (
                  <div className="mx-2 my-3 h-px bg-white/10" />
                )}

                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = isItemActive(pathname, item) ||
                      Boolean(item.children?.some((child) => isItemActive(pathname, child)))
                    const isExpanded = expandedItems.has(item.title)

                    return (
                      <NavItemRow
                        key={item.href}
                        item={item}
                        collapsed={collapsed}
                        isActive={isActive}
                        isExpanded={isExpanded}
                        sectionColor={color}
                        pathname={pathname}
                        onToggleExpanded={onToggleExpanded}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/10 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-xs font-bold text-indigo-300 ring-1 ring-indigo-500/30">
              {getInitials(userDisplayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-slate-100">{userDisplayName}</p>
              {userEmail && userEmail !== userDisplayName && (
                <p className="truncate text-[11px] text-slate-500">{userEmail}</p>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onLogout}
                  className="h-7 w-7 shrink-0 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Cerrar sesión</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-indigo-500/20 text-xs font-bold text-indigo-300 ring-1 ring-indigo-500/30">
                  {getInitials(userDisplayName)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{userDisplayName}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                  onClick={onLogout}
                >
                  <LogOut className="h-3.5 w-3.5" />
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
// Breadcrumb
// ---------------------------------------------------------------------------

function Breadcrumb({ pathname }: { pathname: string }) {
  const crumbs = getBreadcrumbs(pathname)

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
      <Link
        href="/superadmin"
        className="flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-semibold uppercase tracking-widest text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
      >
        <Crown className="h-3 w-3" />
        SA
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
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

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Hydrate from localStorage
  useEffect(() => {
    try {
      setIsCollapsed(window.localStorage.getItem('sa_sidebar_collapsed') === '1')
      const stored = window.localStorage.getItem('sa_sidebar_expanded')
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          setExpandedItems(new Set(parsed.filter((v): v is string => typeof v === 'string')))
        }
      } else {
        setExpandedItems(new Set(['Organizaciones', 'Usuarios', 'Contenido web', 'Monitoreo', 'Mantenimiento']))
      }
    } catch {
      setExpandedItems(new Set(['Organizaciones', 'Usuarios', 'Contenido web', 'Monitoreo', 'Mantenimiento']))
    }
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem('sa_sidebar_collapsed', isCollapsed ? '1' : '0') } catch { /* */ }
  }, [isCollapsed])

  useEffect(() => {
    try { window.localStorage.setItem('sa_sidebar_expanded', JSON.stringify(Array.from(expandedItems))) } catch { /* */ }
  }, [expandedItems])

  // Auto-expand parent when navigating to child
  useEffect(() => {
    const parents = navItems
      .filter((item) => item.children?.some((child) => isItemActive(pathname, child)))
      .map((item) => item.title)
    if (!parents.length) return
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

  const handleNavigate = useCallback(() => setMobileOpen(false), [])

  const sidebarProps: Omit<SidebarContentProps, 'mode'> = {
    pathname,
    isCollapsed,
    expandedItems,
    userDisplayName,
    userEmail,
    onCollapse: () => setIsCollapsed(true),
    onExpand: () => setIsCollapsed(false),
    onToggleExpanded: handleToggleExpanded,
    onNavigate: handleNavigate,
    onLogout: handleLogout,
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950">

        {/* Desktop sidebar */}
        <aside className={cn(
          'hidden shrink-0 transition-[width] duration-200 md:flex md:flex-col',
          isCollapsed ? 'w-[60px]' : 'w-60'
        )}>
          <SidebarContent mode="desktop" {...sidebarProps} />
        </aside>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

          {/* Topbar */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-w-0 items-center gap-2">

              {/* Expand sidebar button */}
              {isCollapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden h-8 w-8 text-slate-500 hover:text-slate-700 md:flex dark:hover:text-slate-300"
                      onClick={() => setIsCollapsed(false)}
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-60 p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Menú Super Admin</SheetTitle>
                  </SheetHeader>
                  <SidebarContent mode="mobile" {...sidebarProps} />
                </SheetContent>
              </Sheet>

              {/* Breadcrumb */}
              <div className="flex min-w-0 items-center gap-2">
                <Breadcrumb pathname={pathname} />
                {activeBadge && (
                  <Badge variant="outline" className="hidden h-5 shrink-0 rounded border-indigo-200 px-1.5 text-[10px] text-indigo-600 sm:inline-flex dark:border-indigo-800 dark:text-indigo-400">
                    {activeBadge}
                  </Badge>
                )}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="hidden items-center gap-1 md:flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                      <Link href="/admin">
                        <Shield className="h-3.5 w-3.5" />
                        Admin
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Ir al panel Admin</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                      <Link href="/dashboard">
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        Dashboard
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Ir al Dashboard</TooltipContent>
                </Tooltip>
              </div>

              {/* Mobile icon-only */}
              <div className="flex items-center gap-1 md:hidden">
                <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                  <Link href="/admin" aria-label="Admin"><Shield className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                  <Link href="/dashboard" aria-label="Dashboard"><LayoutDashboard className="h-4 w-4" /></Link>
                </Button>
              </div>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
              <ThemeToggle />
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

              {/* User chip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                      {getInitials(userDisplayName)}
                    </div>
                    <span className="hidden max-w-[110px] truncate text-xs font-medium text-slate-700 dark:text-slate-300 sm:block">
                      {userDisplayName}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-semibold">{userDisplayName}</p>
                  {userEmail && <p className="text-xs text-muted-foreground">{userEmail}</p>}
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-indigo-400"><Crown className="h-2.5 w-2.5" /> Super Admin</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-x-auto overflow-y-auto">
            <div className="min-w-0 p-4 sm:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
