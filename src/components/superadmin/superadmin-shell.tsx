'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Banknote,
  BarChart3,
  Bug,
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
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Sparkles,
  Store,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

type NavSection = 'overview' | 'tenants' | 'billing' | 'content' | 'system'
type NavIcon = React.ComponentType<{ className?: string }>

type NavChild = {
  title: string
  href: string
  icon: NavIcon
  description?: string
}

type NavItem = NavChild & {
  section: NavSection
  badge?: string
  children?: NavChild[]
}

const sectionMeta: Record<NavSection, { label: string; color: string }> = {
  overview: { label: 'Vision general', color: 'text-sky-400' },
  tenants: { label: 'Tenants', color: 'text-blue-400' },
  billing: { label: 'Facturacion', color: 'text-emerald-400' },
  content: { label: 'Contenido web', color: 'text-violet-400' },
  system: { label: 'Sistema', color: 'text-orange-400' },
}

const sectionOrder: NavSection[] = ['overview', 'tenants', 'billing', 'content', 'system']

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/superadmin', icon: BarChart3, description: 'Metricas globales del sistema', section: 'overview' },
  { title: 'Analiticas', href: '/superadmin/analytics', icon: Activity, description: 'Crecimiento, ingresos y actividad SaaS', section: 'overview' },
  { title: 'Metricas SaaS', href: '/superadmin/saas-metrics', icon: Database, description: 'Uso, consumo y salud comercial', section: 'overview' },
  {
    title: 'Organizaciones',
    href: '/superadmin/organizations',
    icon: Building2,
    description: 'Clientes y tenants del sistema',
    section: 'tenants',
    children: [
      { title: 'Todas las organizaciones', href: '/superadmin/organizations', icon: Building2 },
      { title: 'Nueva organizacion', href: '/superadmin/organizations/create', icon: Sparkles },
      { title: 'Configuracion tenants', href: '/superadmin/organizations/settings', icon: Settings },
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
  { title: 'Planes', href: '/superadmin/plans', icon: Sparkles, badge: 'SaaS', description: 'Planes, limites y paquetes', section: 'billing' },
  { title: 'Suscripciones', href: '/superadmin/subscriptions', icon: CreditCard, description: 'Suscripciones activas por tenant', section: 'billing' },
  { title: 'Historial de pagos', href: '/superadmin/invoices', icon: FileText, description: 'Comprobantes y pagos recibidos', section: 'billing' },
  { title: 'Resumen financiero', href: '/superadmin/billing', icon: Banknote, description: 'MRR, ARR y metricas de ingresos', section: 'billing' },
  {
    title: 'Contenido web',
    href: '/superadmin/web-content',
    icon: Globe,
    description: 'Paginas publicas del sistema SaaS',
    section: 'content',
    children: [
      { title: 'Contenido general', href: '/superadmin/web-content', icon: Globe },
      { title: 'Marca SaaS', href: '/superadmin/web-content/brand', icon: Sparkles },
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
  { title: 'Audit Logs', href: '/superadmin/audit-logs', icon: Shield, description: 'Registro de auditoria y trazabilidad', section: 'system' },
  { title: 'Emails', href: '/superadmin/emails', icon: Mail, description: 'Plantillas transaccionales', section: 'system' },
  { title: 'Configuracion', href: '/superadmin/settings', icon: Settings, description: 'Parametros globales del sistema', section: 'system' },
  {
    title: 'Mantenimiento',
    href: '/superadmin/maintenance',
    icon: Wrench,
    description: 'Cache, sesiones y purga de logs',
    section: 'system',
    children: [
      { title: 'Tareas globales', href: '/superadmin/maintenance', icon: Wrench },
      { title: 'Storage cleanup', href: '/superadmin/storage-cleanup', icon: Trash2 },
    ],
  },
  { title: 'Diagnostico', href: '/superadmin/diagnostic', icon: Bug, description: 'Pruebas rapidas de APIs y permisos', section: 'system' },
]

function isItemActive(pathname: string, item: NavChild) {
  if (item.href === '/superadmin') return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function getActiveItem(pathname: string) {
  const allItems = navItems.flatMap(item => [item, ...(item.children ?? [])])
  return allItems
    .filter(item => isItemActive(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

function getBreadcrumbs(pathname: string): { title: string; href: string }[] {
  const active = getActiveItem(pathname)
  if (!active) return []

  const parent = navItems.find(item => item.children?.some(child => child.href === active.href))
  const segments: { title: string; href: string }[] = []

  if (parent && parent.href !== active.href) {
    segments.push({ title: parent.title, href: parent.href })
  }

  segments.push({ title: active.title, href: active.href })
  return segments
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function ChildLink({
  child,
  pathname,
  onNavigate,
}: {
  child: NavChild
  pathname: string
  onNavigate: (href: string) => void
}) {
  const ChildIcon = child.icon
  const active = isItemActive(pathname, child)

  return (
    <Link
      href={child.href}
      onClick={() => onNavigate(child.href)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex h-9 items-center gap-2 rounded-md pl-7 pr-2 text-[13px] transition-colors',
        active
          ? 'bg-white/10 font-semibold text-white ring-1 ring-white/10'
          : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white/60' : 'bg-white/20 group-hover:bg-white/40')} />
      <ChildIcon className={cn('h-3.5 w-3.5 shrink-0 transition-colors', active ? 'text-white' : 'text-slate-600 group-hover:text-slate-300')} />
      <span className="truncate">{child.title}</span>
    </Link>
  )
}

function CollapsedNavMenu({
  item,
  pathname,
  isActive,
  sectionColor,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  isActive: boolean
  sectionColor: string
  onNavigate: (href: string) => void
}) {
  const Icon = item.icon

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={item.title}
              aria-current={isItemActive(pathname, item) ? 'page' : undefined}
              className={cn(
                'relative flex h-9 w-full items-center justify-center rounded-lg transition-all duration-150',
                isActive ? 'bg-white/10 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? sectionColor : '')} />
              {isActive && <span className="absolute left-0 h-5 w-0.5 rounded-r bg-white/50" />}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          <span>{item.title}</span>
          {item.badge && <Badge variant="secondary" className="h-4 rounded px-1 text-[10px]">{item.badge}</Badge>}
          <span className="text-slate-400">- {item.children?.length ?? 0} subs</span>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent side="right" align="start" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span>{item.title}</span>
          {item.badge && <Badge variant="outline" className="ml-auto h-4 rounded px-1 text-[10px]">{item.badge}</Badge>}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={item.href} onClick={() => onNavigate(item.href)}>
            <Icon className="mr-2 h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {item.children?.map((child) => {
          const ChildIcon = child.icon
          const childActive = isItemActive(pathname, child)

          return (
            <DropdownMenuItem key={child.href} asChild className={cn(childActive && 'bg-accent text-accent-foreground')}>
              <Link href={child.href} onClick={() => onNavigate(child.href)}>
                <ChildIcon className="mr-2 h-4 w-4" />
                <span>{child.title}</span>
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavItemRow({
  item,
  collapsed,
  isActive,
  isExpanded,
  sectionColor,
  pathname,
  onToggleExpanded,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  isActive: boolean
  isExpanded: boolean
  sectionColor: string
  pathname: string
  onToggleExpanded: (title: string) => void
  onNavigate: (href: string) => void
}) {
  const Icon = item.icon
  const hasChildren = Boolean(item.children?.length)
  const isCurrent = isItemActive(pathname, item)

  if (collapsed) {
    if (hasChildren) {
      return (
        <CollapsedNavMenu
          item={item}
          pathname={pathname}
          isActive={isActive}
          sectionColor={sectionColor}
          onNavigate={onNavigate}
        />
      )
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            onClick={() => onNavigate(item.href)}
            aria-label={item.title}
            aria-current={isCurrent ? 'page' : undefined}
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
          <span>{item.title}</span>
          {item.badge && <Badge variant="secondary" className="h-4 rounded px-1 text-[10px]">{item.badge}</Badge>}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div>
      <div className="relative flex items-center gap-0.5">
        {isActive && !hasChildren && <span className="absolute -left-3 h-6 w-0.5 rounded-r bg-white/40" />}
        <Link
          href={item.href}
          onClick={() => onNavigate(item.href)}
          aria-current={isCurrent ? 'page' : undefined}
          className={cn(
            'group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-all duration-150',
            isActive && !hasChildren
              ? 'bg-white/10 text-white'
              : hasChildren && isExpanded
                ? 'text-slate-200 hover:text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
          )}
        >
          <div
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
              isActive || (hasChildren && isExpanded)
                ? `bg-white/10 ${sectionColor}`
                : 'bg-white/5 text-slate-500 group-hover:text-slate-300'
            )}
          >
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

        {hasChildren && (
          <button
            type="button"
            aria-label={isExpanded ? 'Colapsar seccion' : 'Expandir seccion'}
            aria-expanded={isExpanded}
            onClick={() => onToggleExpanded(item.title)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/5 hover:text-slate-300"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isExpanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-3 mt-1 space-y-1 border-l border-white/10 pl-2">
          {item.children?.map((child) => (
            <ChildLink
              key={child.href}
              child={child}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type SidebarContentProps = {
  mode: 'desktop' | 'mobile'
  pathname: string
  isCollapsed: boolean
  expandedItems: Set<string>
  userDisplayName: string
  userEmail: string | null
  onCollapse: () => void
  onToggleExpanded: (title: string) => void
  onNavigate: (href: string) => void
  onCloseMobile: () => void
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
  onToggleExpanded,
  onNavigate,
  onCloseMobile,
  onLogout,
}: SidebarContentProps) {
  const collapsed = mode === 'desktop' && isCollapsed

  return (
    <div className="flex h-full flex-col bg-slate-900">
      <div className={cn('flex h-16 shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center px-3' : 'justify-between px-4')}>
        <Link href="/superadmin" onClick={() => onNavigate('/superadmin')} className={cn('flex min-w-0 items-center gap-3', collapsed && 'mx-auto')}>
          <div className="flex h-8 shrink-0 items-center">
            <img src="/branding/servix-360-logo.png" alt="SERVIX 360" className={cn('w-auto object-contain', collapsed ? 'h-8 max-w-8' : 'h-8 max-w-[132px]')} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-white">SERVIX 360</p>
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
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-white/5" onClick={onCloseMobile}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 py-2">
        <nav className={cn('space-y-1', collapsed ? 'px-2' : 'px-3')}>
          {sectionOrder.map((section) => {
            const items = navItems.filter(item => item.section === section)
            if (!items.length) return null

            const { label, color } = sectionMeta[section]
            const sectionHasActive = items.some(
              item => isItemActive(pathname, item) || item.children?.some(child => isItemActive(pathname, child))
            )

            return (
              <div key={section}>
                {!collapsed ? (
                  <div className={cn('mb-1 mt-3 flex items-center gap-2 rounded-md px-2 py-1', sectionHasActive && 'bg-white/5')}>
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
                    const isActive = isItemActive(pathname, item) || Boolean(item.children?.some(child => isItemActive(pathname, child)))
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
                        onNavigate={onNavigate}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </ScrollArea>

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
                  aria-label="Cerrar sesion"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Cerrar sesion</TooltipContent>
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
              <TooltipContent side="right">Cerrar sesion</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}

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
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />
          {index === crumbs.length - 1 ? (
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
  const defaultExpandedItems = useMemo(
    () => new Set(['Organizaciones', 'Usuarios', 'Contenido web', 'Monitoreo', 'Mantenimiento']),
    []
  )

  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(['Organizaciones', 'Usuarios', 'Contenido web', 'Monitoreo', 'Mantenimiento'])

    try {
      const stored = window.localStorage.getItem('sa_sidebar_expanded')
      if (!stored) return new Set(['Organizaciones', 'Usuarios', 'Contenido web', 'Monitoreo', 'Mantenimiento'])

      const parsed = JSON.parse(stored) as unknown
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((value): value is string => typeof value === 'string'))
      }
    } catch {
      // Ignore malformed local state.
    }

    return new Set(['Organizaciones', 'Usuarios', 'Contenido web', 'Monitoreo', 'Mantenimiento'])
  })
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false

    try {
      return window.localStorage.getItem('sa_sidebar_collapsed') === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem('sa_sidebar_collapsed', isCollapsed ? '1' : '0')
    } catch {
      // Ignore persistence failure.
    }
  }, [isCollapsed])

  useEffect(() => {
    try {
      window.localStorage.setItem('sa_sidebar_expanded', JSON.stringify(Array.from(expandedItems)))
    } catch {
      // Ignore persistence failure.
    }
  }, [expandedItems])

  const effectiveExpandedItems = useMemo(() => {
    const next = new Set(expandedItems.size ? expandedItems : defaultExpandedItems)

    navItems
      .filter(item => item.children?.some(child => isItemActive(pathname, child)))
      .forEach(item => next.add(item.title))

    return next
  }, [defaultExpandedItems, expandedItems, pathname])

  const activeItem = useMemo(() => getActiveItem(pathname), [pathname])
  const activeBadge = (activeItem as NavItem | undefined)?.badge ?? null
  const userDisplayName = user?.profile?.name || userEmail || 'Super admin'

  const handleLogout = useCallback(async () => {
    await signOut()
    router.push('/login')
  }, [router, signOut])

  const handleToggleExpanded = useCallback((title: string) => {
    setExpandedItems((current) => {
      const next = new Set(current)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }, [])

  const handleNavigate = useCallback(() => {
    setMobileOpen(false)
  }, [])

  const sidebarProps: Omit<SidebarContentProps, 'mode'> = {
    pathname,
    isCollapsed,
    expandedItems: effectiveExpandedItems,
    userDisplayName,
    userEmail,
    onCollapse: () => setIsCollapsed(true),
    onToggleExpanded: handleToggleExpanded,
    onNavigate: handleNavigate,
    onCloseMobile: () => setMobileOpen(false),
    onLogout: handleLogout,
  }

  return (
    <TooltipProvider>
      <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950">
        <aside
          className={cn(
            'hidden shrink-0 transition-[width] duration-200 md:flex md:flex-col',
            isCollapsed ? 'w-[60px]' : 'w-60'
          )}
        >
          <SidebarContent mode="desktop" {...sidebarProps} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex min-w-0 items-center gap-2">
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
                  <TooltipContent side="bottom">Expandir menu</TooltipContent>
                </Tooltip>
              )}

              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-60 p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Menu Super Admin</SheetTitle>
                  </SheetHeader>
                  <SidebarContent mode="mobile" {...sidebarProps} />
                </SheetContent>
              </Sheet>

              <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                <Breadcrumb pathname={pathname} />
                {activeBadge && (
                  <Badge variant="outline" className="hidden h-5 shrink-0 rounded border-indigo-200 px-1.5 text-[10px] text-indigo-600 sm:inline-flex dark:border-indigo-800 dark:text-indigo-400">
                    {activeBadge}
                  </Badge>
                )}
              </div>
            </div>

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

              <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 md:block" />
              <ThemeToggle />
              <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 md:block" />

              <div className="hidden md:block">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Super Admin"
                      className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        {getInitials(userDisplayName)}
                      </div>
                      <span className="hidden max-w-[110px] truncate text-xs font-medium text-slate-700 dark:text-slate-300 sm:block">
                        {userDisplayName}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-semibold">{userDisplayName}</p>
                    {userEmail && <p className="text-xs text-muted-foreground">{userEmail}</p>}
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-indigo-400">
                      <Crown className="h-2.5 w-2.5" />
                      Super Admin
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Acciones Super Admin">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="truncate text-sm">{userDisplayName}</span>
                        {userEmail && <span className="truncate text-xs font-normal text-muted-foreground">{userEmail}</span>}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Admin</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => { void handleLogout() }} className="text-red-600 focus:text-red-700">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Cerrar sesion</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

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
