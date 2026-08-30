'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Flame,
  Home,
  LayoutDashboard,
  Package,
  ShoppingCart,
  User,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { usePublicCart } from '@/hooks/use-public-cart'
import { useCartDrawer } from '@/contexts/cart-drawer-context'
import { AuthModal } from '@/components/public/AuthModal'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'

export function StoreMobileBottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { count } = usePublicCart()
  const { open: openCart } = useCartDrawer()
  const [authOpen, setAuthOpen] = useState(false)

  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  const canAccessDashboard =
    user?.role === 'super_admin' ||
    user?.role === 'admin' ||
    user?.role === 'tecnico' ||
    user?.role === 'vendedor'

  const tabs = [
    {
      href: `${tenantPrefix}/inicio`,
      label: 'Inicio',
      icon: Home,
      isActive: pathname === `${tenantPrefix}/inicio` || pathname === tenantPrefix || pathname === '/',
    },
    {
      href: `${tenantPrefix}/productos`,
      label: 'Productos',
      icon: Package,
      isActive: pathname.startsWith(`${tenantPrefix}/productos`) && !pathname.includes('ofertas=true'),
    },
    {
      href: `${tenantPrefix}/productos?ofertas=true`,
      label: 'Ofertas',
      icon: Flame,
      isActive: pathname.includes('ofertas=true') || pathname.startsWith(`${tenantPrefix}/ofertas`),
    },
  ]

  const customerLoginHref = tenantPrefix ? `${tenantPrefix}/cliente/login` : '/login'
  const customerRegisterHref = tenantPrefix ? `${tenantPrefix}/cliente/registro` : '/register'

  return (
    <>
      <nav
        aria-label="Navegación móvil de la tienda"
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border/80 bg-background/95 backdrop-blur-xl px-2 shadow-lg md:hidden"
      >
        {/* Tab 1-3: Inicio, Productos, Ofertas */}
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'group flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition-all select-none',
                tab.isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-200',
                  tab.isActive
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

        {/* Tab 4: Carrito con Badge */}
        <button
          type="button"
          onClick={openCart}
          className="group relative flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all select-none"
        >
          <div className="relative flex h-7 w-7 items-center justify-center rounded-xl group-hover:bg-muted text-muted-foreground transition-all duration-200">
            <ShoppingCart className="h-4.5 w-4.5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground shadow-xs animate-in zoom-in-50">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </div>
          <span className="truncate leading-none">Carrito</span>
        </button>

        {/* Tab 5: Mi Cuenta / Panel */}
        {user ? (
          <Link
            href={canAccessDashboard ? '/dashboard' : `${tenantPrefix}/perfil`}
            className={cn(
              'group flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition-all select-none',
              pathname.startsWith('/dashboard') || pathname.startsWith(`${tenantPrefix}/perfil`)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-200',
                pathname.startsWith('/dashboard') || pathname.startsWith(`${tenantPrefix}/perfil`)
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
            <span className="truncate leading-none">Cuenta</span>
          </button>
        )}
      </nav>

      {/* Modal de Autenticación */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        loginHref={customerLoginHref}
        registerHref={customerRegisterHref}
      />
    </>
  )
}
