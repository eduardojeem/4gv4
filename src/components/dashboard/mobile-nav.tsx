'use client'

import { memo, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Package,
  Users,
  Wrench,
  BarChart3,
  Menu
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'
import { canRoleAccessSection } from '@/lib/auth/section-access'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import type { OrganizationModule } from '@/lib/organization/business-profile'
import { isNavigationModuleAvailable } from '@/lib/navigation/dashboard-navigation'

type NavItem = {
  name: string
  href: string
  icon: LucideIcon
  requiredModule?: OrganizationModule
}

const MOBILE_NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'POS', href: '/dashboard/pos', icon: ShoppingCart, requiredModule: 'pos' },
  { name: 'Pedidos', href: '/dashboard/orders', icon: ShoppingBag },
  { name: 'Productos', href: '/dashboard/products', icon: Package, requiredModule: 'inventory' },
  { name: 'Clientes', href: '/dashboard/customers', icon: Users },
  { name: 'Reparaciones', href: '/dashboard/repairs', icon: Wrench, requiredModule: 'repairs' },
  { name: 'Reportes', href: '/dashboard/reports', icon: BarChart3 },
]

export const MobileNav = memo(function MobileNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { toggleSidebar } = useDashboardLayout()
  const { effectiveModules } = useSubscriptionStatus()
  const userRole = user?.role

  const filteredItems = useMemo(() => {
    return MOBILE_NAV_ITEMS
      .filter((item) => canRoleAccessSection(userRole, item.href))
      .filter((item) => isNavigationModuleAvailable(item.requiredModule, effectiveModules))
      .slice(0, 5)
  }, [userRole, effectiveModules])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80 shadow-lg">
      <div className="flex items-center justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-all duration-200 min-w-[52px]",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-transform",
                isActive && "scale-110"
              )} />
              <span className="text-[10px] font-medium leading-none">{item.name}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full" />
              )}
            </Link>
          )
        })}
        
        {/* Menu button to open sidebar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            "flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg min-w-[52px] h-auto",
            "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Menú</span>
        </Button>
      </div>
    </nav>
  )
})
