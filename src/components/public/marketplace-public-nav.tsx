'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Building2, Grid3X3, LayoutDashboard, LayoutGrid, LogOut, Menu, Package, Search, ShoppingBag, Store, User, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MarketplaceSearchBox } from '@/components/public/MarketplaceSearchBox'
import { useAuth } from '@/contexts/auth-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const navItems = [
  { href: '/marketplace', label: 'Inicio', icon: Store, exact: true },
  { href: '/marketplace/productos', label: 'Productos', icon: Package, exact: false },
  { href: '/marketplace/categorias', label: 'Categorías', icon: Grid3X3, exact: false },
  { href: '/marketplace/empresas', label: 'Empresas', icon: Building2, exact: false },
]

export function MarketplacePublicNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const canAccessDashboard = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'tecnico' || user?.role === 'vendedor'
  const userInitials = user?.profile?.name
    ? user.profile.name
        .split(' ')
        .map((part: string) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleLogout() {
    await signOut()
    setMobileOpen(false)
    router.push('/marketplace')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/marketplace" className="flex items-center gap-3 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold leading-none text-slate-900 dark:text-slate-50">Marketplace</div>
            <div className="mt-0.5 text-[11px] text-slate-400">Empresas y productos</div>
          </div>
        </Link>

        <div className="hidden min-w-0 flex-1 justify-center px-2 xl:flex">
          <MarketplaceSearchBox compact className="w-full max-w-sm" buttonClassName="hidden" />
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                  <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700">
                    <AvatarImage src={user.profile?.avatar_url || ''} alt={user.profile?.name || 'Usuario'} />
                    <AvatarFallback className="bg-cyan-50 text-xs font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-200">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{user.profile?.name || 'Usuario'}</p>
                    <p className="break-all text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canAccessDashboard && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Panel administrativo
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/marketplace" className="cursor-pointer">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Marketplace
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden gap-2 sm:inline-flex">
                <Link href="/login">
                  <User className="h-4 w-4" />
                  Ingresar
                </Link>
              </Button>
              <Button asChild size="sm" className="hidden gap-2 bg-cyan-600 hover:bg-cyan-700 sm:inline-flex dark:bg-cyan-600 dark:hover:bg-cyan-700">
                <Link href="/register">
                  <ShoppingBag className="h-4 w-4" />
                  Crear mi tienda
                </Link>
              </Button>
            </>
          )}
          <Button asChild variant="outline" size="icon" className="lg:hidden">
            <Link href="/marketplace/buscar" aria-label="Buscar en marketplace">
              <Search className="h-4 w-4" />
            </Link>
          </Button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Abrir menú"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
          <nav className="flex flex-col gap-1">
            <MarketplaceSearchBox compact className="mb-2" buttonClassName="hidden" />
            {navItems.map((item) => {
              const active = isActive(item.href, item.exact)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
            <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
              {user ? (
                <div className="space-y-2">
                  <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                    <p className="font-semibold">{user.profile?.name || 'Usuario'}</p>
                    <p className="break-all text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                  {canAccessDashboard && (
                    <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
                      <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                        <LayoutDashboard className="h-4 w-4" />
                        Panel administrativo
                      </Link>
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                    Cerrar sesion
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Button asChild variant="outline" size="sm" className="w-full gap-2">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <User className="h-4 w-4" />
                      Ingresar
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700">
                    <Link href="/register" onClick={() => setMobileOpen(false)}>
                      <ShoppingBag className="h-4 w-4" />
                      Crear mi tienda
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
