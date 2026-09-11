"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Crown,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react'
import { SubscriptionChip } from '@/components/admin/SubscriptionChip'
import { BranchSelector } from '@/components/branches/branch-selector'
import { LogoutDialog } from '@/components/profile/logout-dialog'
import { OrganizationSwitcher } from '@/components/saas/organization-switcher'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GlobalSearch } from '@/components/ui/global-search'
import { normalizeText, primaryModifierLabel } from '@/lib/text/normalize'
import { NotificationBell } from '@/components/ui/notification-bell'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { adminNavCategories, filterCategoriesByPermissions, getNavItemByKey } from '@/config/admin-navigation'
import { useAdminNavBadges } from '@/hooks/use-admin-nav-badges'
import { useAdminLayout } from '@/contexts/AdminLayoutContext'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { cn } from '@/lib/utils'

interface AdminLayoutProps {
  children: React.ReactNode
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['analytics', 'operations', 'administration'])
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { sidebarCollapsed: collapsed, toggleSidebar } = useAdminLayout()
  const { hasPermission, isAdmin, isSuperAdmin, user, signOut } = useAuth()
  // Los modulos efectivos: los del plan menos los que la organizacion apago.
  // Se pasaban los del plan, asi que Analitica, Inventario avanzado o Seguridad
  // seguian en el menu aunque la organizacion los hubiera deshabilitado.
  const { effectiveModules } = useSubscriptionStatus()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const active = searchParams.get('tab') ?? 'overview'
  const currentItem = useMemo(() => getNavItemByKey(active), [active])
  const navBadges = useAdminNavBadges()

  // Oculta del menú las secciones cuyo módulo no está incluido en el plan activo
  // (ej. Analytics, Inventario avanzado, Seguridad si el plan no las trae).
  const visibleCategories = useMemo(
    () => filterCategoriesByPermissions(adminNavCategories, hasPermission, isAdmin, isSuperAdmin, effectiveModules),
    [hasPermission, isAdmin, isSuperAdmin, effectiveModules]
  )

  // El manejador acepta Ctrl y Cmd; el cartel decia «Ctrl» siempre.
  const [shortcutHint, setShortcutHint] = useState('Ctrl+K')
  useEffect(() => {
    setShortcutHint(`${primaryModifierLabel()}${primaryModifierLabel() === '⌘' ? 'K' : '+K'}`)
  }, [])

  const searchableItems = useMemo(
    () =>
      visibleCategories.flatMap(category =>
        category.items.map(item => {
          const href = item.href || '#'
          const subtitle = `${category.label}${item.description ? ` - ${item.description}` : ''}`
          return {
            title: item.label,
            subtitle,
            href,
            type: category.id,
            // Se compara contra esto, no contra el texto con tildes: «analisis»
            // tiene que encontrar «Análisis». Incluye la ruta porque quien
            // conoce la URL escribe «inventory» antes que «Inventario».
            haystack: normalizeText(`${item.label} ${subtitle} ${href}`),
          }
        })
      ),
    [visibleCategories]
  )

  const userInitials = useMemo(() => {
    if (!user?.profile?.name) return 'U'
    return user.profile.name
      .split(' ')
      .map((name: string) => name[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [user])

  const handleLogout = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      await signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }, [])

  const handleSearch = useCallback((input: { query: string; filters?: { type?: string } }) => {
    const type = input.filters?.type ?? 'todos'
    // Cada palabra por separado: «config sitio» encuentra «Sitio Web ·
    // Configuración del sitio web público», que con la frase entera no salia.
    const terms = normalizeText(input.query).split(/\s+/).filter(Boolean)

    return searchableItems
      .filter(item => {
        if (type !== 'todos' && item.type !== type) return false
        return terms.every(term => item.haystack.includes(term))
      })
      .slice(0, 25)
  }, [searchableItems])

  const handleKeydown = useCallback((event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      setSearchOpen(true)
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault()
      toggleSidebar()
    }
  }, [toggleSidebar])

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [handleKeydown])

  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileSidebarOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileSidebarOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        aria-label="Menu lateral"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card text-card-foreground shadow-lg transition-all duration-300 ease-in-out lg:static lg:shadow-none',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-20 lg:w-20' : 'w-72 lg:w-72',
          'lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          {!collapsed && (
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-xl font-bold text-transparent">
              Admin
            </span>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn('ml-auto hidden text-muted-foreground hover:text-foreground lg:flex', collapsed && 'mx-auto')}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Contraer menu lateral'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5 rotate-90" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(false)}
            className="text-muted-foreground lg:hidden"
            aria-label="Cerrar menu lateral"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {visibleCategories.map(category => {
            const isExpanded = expandedCategories.includes(category.id)

            return (
              <div key={category.id} className="space-y-2">
                {!collapsed && (
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex w-full items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                    aria-expanded={isExpanded}
                  >
                    <span>{category.label}</span>
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                )}

                {collapsed && <div className="mx-2 h-px bg-border" />}

                {(collapsed || isExpanded) && (
                  <div className="space-y-1">
                    {category.items.map(({ key, label, icon: Icon, description, href, badge }) => {
                      const isActive = href === '/admin'
                        ? pathname === href
                        : pathname.startsWith(href || '')
                      const pendientes = badge ? navBadges[badge] ?? 0 : 0

                      return (
                        <Link
                          key={key}
                          href={href || '#'}
                          onClick={() => setMobileSidebarOpen(false)}
                          className={cn(
                            'group flex items-center rounded-xl transition-all duration-200',
                            collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                            isActive
                              ? 'bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                          title={collapsed ? label : description}
                          aria-label={pendientes > 0 ? `${label}: ${pendientes} sin resolver` : undefined}
                        >
                          <span className="relative flex-shrink-0">
                            <Icon
                              className={cn(
                                'transition-colors',
                                collapsed ? 'h-6 w-6' : 'h-5 w-5',
                                isActive
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-muted-foreground group-hover:text-foreground'
                              )}
                            />
                            {/* Plegado no entra el numero, pero el punto tiene
                                que verse igual: es todo el sentido de esto. */}
                            {collapsed && pendientes > 0 && (
                              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-rose-500" aria-hidden />
                            )}
                          </span>
                          {!collapsed && <span>{label}</span>}
                          {!collapsed && pendientes > 0 && (
                            <span className="ml-auto min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums text-white">
                              {pendientes > 99 ? '99+' : pendientes}
                            </span>
                          )}
                          {!collapsed && pendientes === 0 && isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="space-y-2 border-t border-border bg-muted/20 p-4">
          <SubscriptionChip variant="sidebar" />
          <Link
            href="/dashboard"
            onClick={() => setMobileSidebarOpen(false)}
            className={cn(
              'flex items-center rounded-xl border border-transparent text-muted-foreground shadow-sm transition-all duration-200 hover:border-border hover:bg-background hover:text-foreground',
              collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
            )}
            title="Volver a Inicio"
          >
            <ArrowLeft className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
            {!collapsed && <span className="text-sm font-medium">Volver a Inicio</span>}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileSidebarOpen(prev => !prev)}
                aria-label={mobileSidebarOpen ? 'Cerrar menu lateral' : 'Abrir menu lateral'}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* En 375px «Inicio / Admin / Seccion» compite con el boton de
                  menu y tres iconos. Lo que importa es donde estas. */}
              <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground md:hidden">
                {currentItem?.label ?? 'Administración'}
              </p>
              <div className="hidden min-w-0 flex-1 md:block">
                <Breadcrumbs items={[
                  { label: 'Inicio', href: '/dashboard' },
                  { label: 'Admin', href: '/admin' },
                  { label: currentItem?.label ?? 'Seccion' },
                ]} />
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Era un <input readOnly> con onClick: recibia el foco pero no
                  se abria con Enter. Un boton lo hace alcanzable por teclado y
                  se anuncia como lo que es. */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-haspopup="dialog"
                className="group hidden h-9 w-56 items-center gap-2 rounded-md border border-border/60 bg-muted/50 pl-3 pr-2 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex lg:w-64"
              >
                <Search className="h-4 w-4 shrink-0 transition-colors group-hover:text-foreground" />
                {/* El cartel decia «Ctrl+K» y adentro habia otro «Ctrl+K». */}
                <span className="flex-1 text-left">Buscar</span>
                <kbd className="inline-flex h-5 shrink-0 items-center rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
                  {shortcutHint}
                </kbd>
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 md:hidden"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar en el panel"
                aria-haspopup="dialog"
              >
                <Search className="h-5 w-5" />
              </Button>

              {user?.role === 'super_admin' && (
                <Button asChild variant="outline" size="sm" className="hidden h-9 gap-1.5 border-purple-200/60 text-purple-600 shadow-sm hover:bg-purple-50 dark:border-purple-800/40 dark:text-purple-400 dark:hover:bg-purple-950/20 sm:inline-flex">
                  <Link href="/superadmin" className="flex items-center gap-1.5">
                    <Crown className="h-4 w-4 shrink-0" />
                    <span className="hidden font-medium lg:inline">Super Admin</span>
                  </Link>
                </Button>
              )}

              {(user?.role === 'admin' || user?.role === 'super_admin') && (
                <Button asChild variant="outline" size="sm" className="hidden h-9 gap-1.5 border-border/80 shadow-sm sm:inline-flex">
                  <Link href="/dashboard" className="flex items-center gap-1.5">
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span className="hidden font-medium lg:inline">Inicio</span>
                  </Link>
                </Button>
              )}

              <div className="hidden items-center gap-3 md:flex">
                <OrganizationSwitcher compact />
                <BranchSelector compact />
              </div>

              <div className="hidden h-6 w-px bg-border/60 md:block" />
              <ThemeToggle />
              <NotificationBell />
              <div className="hidden h-5 w-px bg-border/60 md:block" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 ring-2 ring-transparent transition-all hover:ring-primary/10">
                    <Avatar className="h-8 w-8 border border-border shadow-sm">
                      <AvatarImage src={user?.profile?.avatar_url || '/avatars/01.svg'} alt={user?.profile?.name || 'Usuario'} />
                      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{userInitials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-2" align="end" forceMount sideOffset={8}>
                  <DropdownMenuLabel className="p-1 font-normal">
                    <div className="flex items-center gap-2.5 px-1 py-1.5">
                      <Avatar className="h-9 w-9 border border-border shadow-sm">
                        <AvatarImage src={user?.profile?.avatar_url || '/avatars/01.svg'} alt={user?.profile?.name || 'Usuario'} />
                        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{userInitials}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-0.5 min-w-0">
                        <p className="text-sm font-semibold leading-none truncate">{user?.profile?.name || 'Usuario'}</p>
                        <p className="break-all text-xs leading-none text-muted-foreground truncate">
                          {user?.email || 'usuario@email.com'}
                        </p>
                        {user?.role && (
                          <div className="pt-0.5">
                            <span
                              className={cn(
                                'rounded-full border px-1.5 py-0.5 text-[9px] font-medium capitalize',
                                user.role === 'admin'
                                  ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-700/50 dark:bg-purple-900/30 dark:text-purple-300'
                                  : user.role === 'vendedor'
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700/50 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-600/50 dark:bg-gray-800/50 dark:text-gray-300'
                              )}
                            >
                              {user.role}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-2" />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard"
                      className="flex w-full cursor-pointer items-center rounded-md px-3 py-2.5 transition-colors focus:bg-accent focus:text-accent-foreground"
                    >
                      <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <LayoutDashboard className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">Inicio</span>
                        <span className="text-xs text-muted-foreground">Volver al panel principal</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard/profile"
                      className="flex w-full cursor-pointer items-center rounded-md px-3 py-2.5 transition-colors focus:bg-accent focus:text-accent-foreground"
                    >
                      <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">Mi Perfil</span>
                        <span className="text-xs text-muted-foreground">Ver informacion personal</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/admin/settings"
                      className="mt-1 flex w-full cursor-pointer items-center rounded-md px-3 py-2.5 transition-colors focus:bg-accent focus:text-accent-foreground"
                    >
                      <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Settings className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">Configuración</span>
                        <span className="text-xs text-muted-foreground">Datos de la empresa, impuestos y moneda</span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  {user?.role === 'super_admin' && (
                    <DropdownMenuItem asChild>
                      <Link
                        href="/superadmin"
                        className="mt-1 flex w-full cursor-pointer items-center rounded-md px-3 py-2.5 transition-colors focus:bg-accent focus:text-accent-foreground"
                      >
                        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                          <Shield className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">Super Admin</span>
                          <span className="text-xs text-muted-foreground">Panel global SaaS</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="my-2" />
                  <DropdownMenuItem
                    onClick={() => setLogoutOpen(true)}
                    disabled={loading}
                    className="group mt-1 cursor-pointer rounded-md px-3 py-2.5 text-red-600 transition-colors focus:bg-red-50 focus:text-red-700"
                  >
                    <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-red-100 text-red-600 transition-colors group-hover:bg-red-200 group-hover:text-red-700">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">Cerrar Sesion</span>
                      <span className="text-xs text-red-600/70">Salir del sistema</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Esta fila duplicaba cuatro componentes que ya estan arriba:
              el selector de organizacion, el de sucursal, «Inicio» y «Super
              Admin». Con el buscador aparte, el encabezado movil ocupaba unos
              150px fijos de una pantalla de 812.

              «Inicio» y «Super Admin» estaban de hecho TRES veces cada uno:
              el boton del encabezado, esta fila, y el menu del avatar. Con
              sacar esta copia siguen alcanzables desde los otros dos lados.

              Queda solo el contexto —en que empresa y en que sucursal estas—,
              que es lo unico que hay que poder ver sin abrir nada. */}
          <div className="flex items-center gap-2 px-4 pb-2.5 md:hidden">
            <OrganizationSwitcher compact />
            <BranchSelector compact className="min-w-0 flex-1" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 scroll-smooth md:p-6">
          <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
            {children}
          </div>
        </main>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onSearch={handleSearch} />
      <LogoutDialog
        open={logoutOpen}
        loading={loading}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  )
}

function AdminLayoutFallback() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="hidden w-72 space-y-6 border-r border-border bg-card p-6 lg:block">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(item => (
            <div key={item} className="h-10 animate-pulse rounded-xl bg-muted/70" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="h-16 border-b border-border bg-background/80" />
        <div className="space-y-6 p-8">
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
          <div className="grid grid-cols-3 gap-6">
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <Suspense fallback={<AdminLayoutFallback />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  )
}
