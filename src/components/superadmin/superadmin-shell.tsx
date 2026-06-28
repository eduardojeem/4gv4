'use client'

import Link from 'next/link'
import Image from 'next/image'
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
  Bell,
  Mail,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Sparkles,
  Store,
  TicketPercent,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
  { title: 'Promociones', href: '/superadmin/promo-codes', icon: TicketPercent, badge: 'Nuevo', description: 'Descuentos y activaciones SaaS', section: 'billing' },
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
  { title: 'Notificaciones', href: '/superadmin/notifications', icon: Bell, description: 'Notificaciones globales a tenants', section: 'system' },
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
        'group flex h-9 items-center gap-2 rounded-md pl-8 pr-2 text-[13px] transition-colors',
        active
          ? 'bg-white/10 font-semibold text-white ring-1 ring-inset ring-white/10'
          : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
      )}
    >
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
        {isActive && !hasChildren && <span className={cn('absolute -left-3 h-6 w-0.5 rounded-r', sectionColor.replace('text-', 'bg-'))} />}
        <Link
          href={item.href}
          onClick={() => onNavigate(item.href)}
          aria-current={isCurrent ? 'page' : undefined}
          className={cn(
            'group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-all duration-150',
            isActive
              ? 'bg-white/10 text-white ring-1 ring-inset ring-white/10'
              : hasChildren && isExpanded
                ? 'bg-white/[0.03] text-slate-200 hover:text-white'
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
            aria-label={isExpanded ? `Colapsar ${item.title}` : `Expandir ${item.title}`}
            aria-expanded={isExpanded}
            onClick={() => onToggleExpanded(item.title)}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/5 hover:text-slate-300',
              isExpanded ? 'text-slate-300' : 'text-slate-600'
            )}
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
  collapsedSections: Set<NavSection>
  userDisplayName: string
  userEmail: string | null
  onToggleExpanded: (title: string) => void
  onToggleSection: (section: NavSection) => void
  onNavigate: (href: string) => void
  onCloseMobile: () => void
  onLogout: () => void
}

function SidebarContent({
  mode,
  pathname,
  isCollapsed,
  expandedItems,
  collapsedSections,
  userDisplayName,
  userEmail,
  onToggleExpanded,
  onToggleSection,
  onNavigate,
  onCloseMobile,
  onLogout,
}: SidebarContentProps) {
  const collapsed = mode === 'desktop' && isCollapsed

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <div className={cn('flex h-16 shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center px-3' : 'justify-between px-4')}>
        <Link href="/superadmin" onClick={() => onNavigate('/superadmin')} className={cn('flex min-w-0 items-center gap-3', collapsed && 'mx-auto')}>
          <div className="flex h-8 shrink-0 items-center">
            <Image
              src="/branding/servix-360-logo.png"
              alt="SERVIX 360"
              width={132}
              height={32}
              priority
              className={cn('w-auto object-contain', collapsed ? 'h-8 max-w-8' : 'h-8 max-w-[132px]')}
            />
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

        {mode === 'mobile' && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-white/5" onClick={onCloseMobile}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!collapsed && (
        <div className="shrink-0 border-b border-white/10 px-3 py-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/20">
                <Crown className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200">Control global</p>
                <p className="truncate text-[10px] text-slate-500">Plataforma, tenants y sistema</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/10" title="Panel disponible" />
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 py-2">
        <nav className={cn('space-y-1', collapsed ? 'px-2' : 'px-3')}>
          {sectionOrder.map((section) => {
            const items = navItems.filter(item => item.section === section)
            if (!items.length) return null

            const { label, color } = sectionMeta[section]
            const sectionHasActive = items.some(
              item => isItemActive(pathname, item) || item.children?.some(child => isItemActive(pathname, child))
            )
            const sectionCollapsed = collapsedSections.has(section) && !sectionHasActive

            return (
              <div key={section} className="py-0.5">
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => onToggleSection(section)}
                    aria-expanded={!sectionCollapsed}
                    className={cn(
                      'mb-1 mt-2 flex h-7 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-white/5',
                      sectionHasActive && 'bg-white/5'
                    )}
                  >
                    <div className={cn('h-1.5 w-1.5 rounded-full', color.replace('text-', 'bg-'))} />
                    <span className={cn('min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.18em]', color)}>
                      {label}
                    </span>
                    <ChevronDown className={cn('h-3 w-3 text-slate-600 transition-transform', sectionCollapsed && '-rotate-90')} />
                  </button>
                ) : (
                  <div className="mx-2 my-3 h-px bg-white/10" />
                )}

                <div className={cn('grid transition-[grid-template-rows,opacity] duration-200', sectionCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100')}>
                  <div className="min-h-0 space-y-0.5 overflow-hidden">
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
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-white/10 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
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
  const defaultExpandedItems = useMemo(() => new Set<string>(), [])

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<NavSection>>(new Set())
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Read persisted sidebar state after hydration to avoid SSR/client mismatch
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('sa_sidebar_expanded')
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          setExpandedItems(new Set(parsed.filter((v): v is string => typeof v === 'string')))
        }
      }
    } catch { /* ignore */ }

    try {
      const stored = window.localStorage.getItem('sa_sidebar_collapsed_sections')
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          setCollapsedSections(new Set(parsed.filter((v): v is NavSection => sectionOrder.includes(v as NavSection))))
        }
      }
    } catch { /* ignore */ }

    try {
      if (window.localStorage.getItem('sa_sidebar_collapsed') === '1') {
        setIsCollapsed(true)
      }
    } catch { /* ignore */ }
  }, [])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const handleToggleSidebar = useCallback(() => {
    setIsCollapsed(collapsed => !collapsed)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(open => !open)
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        handleToggleSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleToggleSidebar])

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

  useEffect(() => {
    try {
      window.localStorage.setItem('sa_sidebar_collapsed_sections', JSON.stringify(Array.from(collapsedSections)))
    } catch {
      // Ignore persistence failure.
    }
  }, [collapsedSections])

  const effectiveExpandedItems = useMemo(() => {
    const next = new Set(expandedItems.size ? expandedItems : defaultExpandedItems)

    navItems
      .filter(item => item.children?.some(child => isItemActive(pathname, child)))
      .forEach(item => next.add(item.title))

    return next
  }, [defaultExpandedItems, expandedItems, pathname])

  const activeItem = useMemo(() => getActiveItem(pathname), [pathname])
  const activeBadge = (activeItem as NavItem | undefined)?.badge ?? null
  const ActiveIcon = activeItem?.icon ?? Crown
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

  const handleToggleSection = useCallback((section: NavSection) => {
    setCollapsedSections((current) => {
      const next = new Set(current)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }, [])

  const handleNavigate = useCallback(() => {
    setMobileOpen(false)
    setSearchOpen(false)
  }, [])

  const handleCommandNavigate = useCallback((href: string) => {
    handleNavigate()
    router.push(href)
  }, [handleNavigate, router])

  const sidebarProps: Omit<SidebarContentProps, 'mode'> = {
    pathname,
    isCollapsed,
    expandedItems: effectiveExpandedItems,
    collapsedSections,
    userDisplayName,
    userEmail,
    onToggleExpanded: handleToggleExpanded,
    onToggleSection: handleToggleSection,
    onNavigate: handleNavigate,
    onCloseMobile: () => setMobileOpen(false),
    onLogout: handleLogout,
  }

  return (
    <TooltipProvider>
      <div className="relative flex h-dvh overflow-hidden bg-slate-950 md:gap-2 md:p-2">
        <a
          href="#superadmin-content"
          className="sr-only z-[100] rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 shadow-lg focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Saltar al contenido
        </a>

        <aside
          className={cn(
            'hidden shrink-0 overflow-hidden transition-[width] duration-200 md:flex md:flex-col md:rounded-xl md:border md:border-white/10 md:shadow-2xl md:shadow-black/20',
            isCollapsed ? 'w-[60px]' : 'w-64'
          )}
        >
          <SidebarContent mode="desktop" {...sidebarProps} />
        </aside>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleToggleSidebar}
              aria-label={isCollapsed ? 'Expandir menu lateral' : 'Colapsar menu lateral'}
              aria-expanded={!isCollapsed}
              className={cn(
                'absolute top-7 z-40 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 shadow-lg shadow-black/30 transition-[left,background-color,color,border-color] duration-200 hover:border-slate-500 hover:bg-slate-800 hover:text-white md:flex',
                isCollapsed ? 'left-[56px]' : 'left-[252px]'
              )}
            >
              {isCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>{isCollapsed ? 'Expandir menu' : 'Colapsar menu'}</span>
            <kbd className="rounded border px-1 py-0.5 text-[10px]">Ctrl B</kbd>
          </TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 md:rounded-xl md:border md:border-white/10 md:shadow-2xl md:shadow-black/20 dark:bg-slate-950">
          <header className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-3 shadow-sm shadow-slate-950/[0.02] backdrop-blur-xl sm:px-4 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-black/10">
            <div className="flex min-w-0 items-center gap-2">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Menu Super Admin</SheetTitle>
                  </SheetHeader>
                  <SidebarContent mode="mobile" {...sidebarProps} />
                </SheetContent>
              </Sheet>

              <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

              <div className="flex min-w-0 items-center gap-2.5">
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 sm:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <ActiveIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {activeItem?.title ?? 'Super Admin'}
                    </p>
                    {activeBadge && (
                      <Badge variant="outline" className="hidden h-5 shrink-0 rounded border-indigo-200 px-1.5 text-[10px] text-indigo-600 sm:inline-flex dark:border-indigo-800 dark:text-indigo-400">
                        {activeBadge}
                      </Badge>
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <Breadcrumb pathname={pathname} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="hidden h-9 w-52 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-500 transition-colors hover:border-slate-300 hover:bg-white lg:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800/70"
                aria-label="Buscar secciones"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="flex-1">Buscar secciones...</span>
                <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-900">
                  Ctrl K
                </kbd>
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 lg:hidden"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar secciones"
              >
                <Search className="h-4 w-4" />
              </Button>

              <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 md:block" />
              <ThemeToggle />
              <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 md:block" />

              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Abrir menu de Super Admin"
                      className="flex h-9 items-center gap-2 rounded-lg px-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        {getInitials(userDisplayName)}
                      </div>
                      <span className="hidden max-w-[110px] truncate text-xs font-medium text-slate-700 dark:text-slate-300 sm:block">
                        {userDisplayName}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>
                      <p className="truncate text-sm">{userDisplayName}</p>
                      {userEmail && <p className="truncate text-xs font-normal text-muted-foreground">{userEmail}</p>}
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-indigo-500">
                        <Crown className="h-3 w-3" />
                        Acceso global Super Admin
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <Shield className="mr-2 h-4 w-4" />
                        Panel Admin
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard operativo
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => { void handleLogout() }} className="text-red-600 focus:text-red-700">
                      <LogOut className="mr-2 h-4 w-4" />
                      Cerrar sesion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

          <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
            <CommandInput placeholder="Buscar organizaciones, facturacion, monitoreo..." />
            <CommandList>
              <CommandEmpty>No se encontraron secciones.</CommandEmpty>
              {sectionOrder.map((section) => {
                const items = navItems.filter(item => item.section === section)
                return (
                  <CommandGroup key={section} heading={sectionMeta[section].label}>
                    {items.flatMap(item => [item, ...(item.children ?? [])]).map((item, index) => {
                      const ItemIcon = item.icon
                      return (
                        <CommandItem
                          key={`${section}-${item.href}-${index}`}
                          value={`${item.title} ${item.description ?? ''}`}
                          onSelect={() => handleCommandNavigate(item.href)}
                          className="gap-3"
                        >
                          <ItemIcon className="h-4 w-4 text-slate-500" />
                          <span className="flex-1">{item.title}</span>
                          {isItemActive(pathname, item) && (
                            <Badge variant="secondary" className="text-[10px]">Actual</Badge>
                          )}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </CommandDialog>

          <main
            id="superadmin-content"
            className="relative flex-1 overflow-x-auto overflow-y-auto bg-slate-100/70 outline-none dark:bg-slate-950"
            tabIndex={-1}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-white via-white/40 to-transparent dark:from-slate-900/70 dark:via-slate-900/20"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-indigo-200/20 blur-3xl dark:bg-indigo-950/20"
            />
            <div className="relative min-w-0 px-4 py-5 sm:px-6 sm:py-7 xl:px-8 xl:py-8">
              <div className="mx-auto w-full max-w-[1680px]">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
