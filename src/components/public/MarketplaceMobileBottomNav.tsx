'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Grid3X3,
  Home,
  LayoutDashboard,
  Package,
  Store,
  User,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { AuthModal } from '@/components/public/AuthModal'
import { cn } from '@/lib/utils'

export function MarketplaceMobileBottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)

  const canAccessDashboard =
    user?.role === 'super_admin' ||
    user?.role === 'admin' ||
    user?.role === 'tecnico' ||
    user?.role === 'vendedor'

  const tabs = [
    { href: '/marketplace', label: 'Inicio', icon: Home, exact: true },
    { href: '/marketplace/productos', label: 'Productos', icon: Package, exact: false },
    { href: '/marketplace/categorias', label: 'Categorías', icon: Grid3X3, exact: false },
    { href: '/marketplace/empresas', label: 'Tiendas', icon: Store, exact: false },
  ]

  return (
    <>
      <nav
        aria-label="Navegación móvil"
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border/80 bg-background/95 backdrop-blur-xl px-2 shadow-lg lg:hidden"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'group flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition-all select-none',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary scale-110 shadow-xs'
                    : 'group-hover:bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="truncate leading-none">{tab.label}</span>
            </Link>
          )
        })}

        {/* Tab 5: Mi Cuenta / Panel */}
        {user ? (
          <Link
            href={canAccessDashboard ? '/dashboard' : '/marketplace'}
            className={cn(
              'group flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition-all select-none',
              pathname.startsWith('/dashboard')
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-200',
                pathname.startsWith('/dashboard')
                  ? 'bg-primary/10 text-primary scale-110 shadow-xs'
                  : 'group-hover:bg-muted text-muted-foreground'
              )}
            >
              {canAccessDashboard ? (
                <LayoutDashboard className="h-4.5 w-4.5" />
              ) : (
                <User className="h-4.5 w-4.5" />
              )}
            </div>
            <span className="truncate leading-none">
              {canAccessDashboard ? 'Panel' : 'Perfil'}
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="group flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all select-none"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl group-hover:bg-muted text-muted-foreground transition-all duration-200">
              <User className="h-4.5 w-4.5" />
            </div>
            <span className="truncate leading-none">Acceder</span>
          </button>
        )}
      </nav>

      {/* Auth modal si hace clic en Acceder */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
