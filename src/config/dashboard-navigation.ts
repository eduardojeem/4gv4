import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent,
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  HandCoins,
  PackageSearch,
  RotateCcw,
  Settings2,
  ShoppingCart,
  Tags,
  Truck,
  UsersRound,
  Wrench,
  BadgeCheck,
} from 'lucide-react'

import type { UserRole } from '@/lib/auth/roles-permissions'
import { canRoleAccessSection } from '@/lib/auth/section-access'
import type { OrganizationModule } from '@/lib/organization/business-profile'
import { isNavigationModuleAvailable } from '@/lib/navigation/dashboard-navigation'

export type DashboardNavItem = {
  key: string
  label: string
  href: string
  icon: LucideIcon
  description: string
  permission?: string
  module?: OrganizationModule
  mobilePriority?: number
}

export type DashboardNavGroup = {
  id: string
  label: string
  items: DashboardNavItem[]
}

export const dashboardNavGroups: DashboardNavGroup[] = [
  {
    id: 'primary',
    label: 'Principal',
    items: [
      { key: 'overview', label: 'Resumen', href: '/dashboard', icon: Gauge, description: 'Estado general del negocio', mobilePriority: 10 },
      { key: 'pos', label: 'Punto de venta', href: '/dashboard/pos', icon: ShoppingCart, description: 'Registrar una venta', permission: 'pos.read', module: 'pos', mobilePriority: 20 },
      { key: 'cash-register', label: 'Caja', href: '/dashboard/pos/caja', icon: Banknote, description: 'Apertura, movimientos y cierre', permission: 'pos.read', module: 'pos', mobilePriority: 70 },
    ],
  },
  {
    id: 'sales',
    label: 'Ventas',
    items: [
      { key: 'orders', label: 'Pedidos', href: '/dashboard/orders', icon: ClipboardList, description: 'Pedidos y entregas', permission: 'orders.read', module: 'orders', mobilePriority: 30 },
      { key: 'customers', label: 'Clientes', href: '/dashboard/customers', icon: UsersRound, description: 'Clientes e historial', permission: 'customers.read', mobilePriority: 60 },
      { key: 'credits', label: 'Créditos', href: '/dashboard/credits', icon: HandCoins, description: 'Financiaciones y cobros', permission: 'credits.read', module: 'credits' },
      { key: 'after-sales', label: 'Posventa', href: '/dashboard/after-sales', icon: RotateCcw, description: 'Garantías, cambios y devoluciones', permission: 'customers.read' },
      { key: 'promotions', label: 'Promociones', href: '/dashboard/promotions', icon: BadgePercent, description: 'Descuentos y campañas', permission: 'promotions.read', module: 'promotions' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario',
    items: [
      { key: 'products', label: 'Productos', href: '/dashboard/products', icon: Boxes, description: 'Catálogo y existencias', permission: 'products.read', module: 'inventory', mobilePriority: 40 },
      { key: 'categories', label: 'Categorías', href: '/dashboard/categories', icon: Tags, description: 'Organización del catálogo', permission: 'products.read', module: 'inventory' },
      { key: 'brands', label: 'Marcas', href: '/dashboard/brands', icon: BadgeCheck, description: 'Marcas del catálogo', permission: 'products.manage', module: 'inventory' },
      { key: 'suppliers', label: 'Proveedores', href: '/dashboard/suppliers', icon: Truck, description: 'Compras y abastecimiento', module: 'inventory' },
    ],
  },
  {
    id: 'workshop',
    label: 'Taller',
    items: [
      { key: 'repairs', label: 'Reparaciones', href: '/dashboard/repairs', icon: Wrench, description: 'Órdenes y seguimiento', permission: 'repairs.read', module: 'repairs', mobilePriority: 50 },
      { key: 'repair-inventory', label: 'Inventario del taller', href: '/dashboard/repairs/inventory', icon: PackageSearch, description: 'Repuestos e insumos', permission: 'repairs.read', module: 'repairs' },
      { key: 'technician', label: 'Panel técnico', href: '/dashboard/technician', icon: ClipboardCheck, description: 'Trabajo asignado a técnicos', module: 'repairs' },
    ],
  },
  {
    id: 'management',
    label: 'Análisis y gestión',
    items: [
      { key: 'pos-analytics', label: 'Analítica de ventas', href: '/dashboard/pos/dashboard', icon: ChartNoAxesCombined, description: 'Indicadores y rentabilidad', module: 'pos' },
      { key: 'administration', label: 'Administración', href: '/admin', icon: Settings2, description: 'Configuración y gestión avanzada' },
    ],
  },
]

export function getDashboardNavItemByPath(pathname: string): DashboardNavItem | undefined {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/'

  return dashboardNavGroups
    .flatMap((group) => group.items)
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export function filterDashboardNavGroups({
  role,
  effectiveModules,
  hasPermission,
}: {
  role: UserRole | undefined
  effectiveModules: readonly string[]
  hasPermission: (permission: string) => boolean
}): DashboardNavGroup[] {
  return dashboardNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!isNavigationModuleAvailable(item.module, effectiveModules)) return false
        if (!canRoleAccessSection(role, item.href)) return false
        return item.permission ? hasPermission(item.permission) : true
      }),
    }))
    .filter((group) => group.items.length > 0)
}

export function getMobileDashboardItems(
  groups: DashboardNavGroup[],
  limit = 5,
): DashboardNavItem[] {
  return groups
    .flatMap((group) => group.items)
    .filter((item) => item.mobilePriority !== undefined)
    .sort((a, b) => (a.mobilePriority ?? Number.MAX_SAFE_INTEGER) - (b.mobilePriority ?? Number.MAX_SAFE_INTEGER))
    .slice(0, limit)
}
