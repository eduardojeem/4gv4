import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent,
  Banknote,
  Boxes,
  ChartNoAxesCombined,
  ClipboardCheck,
  CalendarClock,
  CalendarX2,
  ClipboardList,
  FileText,
  ScanBarcode,
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
import { requirementForPath } from '@/lib/navigation/route-modules'

export type DashboardNavItem = {
  key: string
  label: string
  href: string
  icon: LucideIcon
  description: string
  mobileLabel?: string
  permission?: string
  /** Con una lista alcanza con cualquiera de los módulos. */
  module?: OrganizationModule | readonly OrganizationModule[]
  mobilePriority?: number
  /** Solo para estos rubros (vacío = todos). */
  verticals?: readonly string[]
}

export type DashboardNavGroup = {
  id: string
  label: string
  items: DashboardNavItem[]
}

// El módulo y los rubros de cada item no se escriben acá: salen de
// ROUTE_MODULES (src/lib/navigation/route-modules.ts), la misma tabla que usan
// las páginas, para que el menú y la página no puedan pedir cosas distintas.
const rawDashboardNavGroups: DashboardNavGroup[] = [
  {
    id: 'primary',
    label: 'Principal',
    items: [
      { key: 'overview', label: 'Resumen', href: '/dashboard', icon: Gauge, description: 'Estado general del negocio', mobilePriority: 10 },
      { key: 'pos', label: 'Punto de venta', mobileLabel: 'POS', href: '/dashboard/pos', icon: ShoppingCart, description: 'Registrar una venta', permission: 'pos.read', mobilePriority: 20 },
      { key: 'agenda', label: 'Agenda', href: '/dashboard/agenda', icon: CalendarClock, description: 'Turnos por profesional y reservas online', permission: 'pos.read', mobilePriority: 25 },
      { key: 'cash-register', label: 'Caja', href: '/dashboard/pos/caja', icon: Banknote, description: 'Apertura, movimientos y cierre', permission: 'pos.read', mobilePriority: 70 },
    ],
  },
  {
    id: 'sales',
    label: 'Ventas',
    items: [
      { key: 'orders', label: 'Pedidos', href: '/dashboard/orders', icon: ClipboardList, description: 'Pedidos y entregas', permission: 'orders.read', mobilePriority: 30 },
      { key: 'quotes', label: 'Presupuestos', href: '/dashboard/quotes', icon: FileText, description: 'Cotizaciones por WhatsApp que pasan a venta', permission: 'pos.read' },
      { key: 'customers', label: 'Clientes', href: '/dashboard/customers', icon: UsersRound, description: 'Clientes e historial', permission: 'customers.read', mobilePriority: 60 },
      { key: 'credits', label: 'Créditos', href: '/dashboard/credits', icon: HandCoins, description: 'Financiaciones y cobros', permission: 'credits.read' },
      { key: 'after-sales', label: 'Posventa', href: '/dashboard/after-sales', icon: RotateCcw, description: 'Garantías, cambios y devoluciones', permission: 'customers.read' },
      { key: 'promotions', label: 'Promociones', href: '/dashboard/promotions', icon: BadgePercent, description: 'Descuentos y campañas', permission: 'promotions.read' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario',
    items: [
      // Los servicios de la agenda se cargan como productos: una cuenta solo de servicios también lo necesita.
      { key: 'products', label: 'Productos', href: '/dashboard/products', icon: Boxes, description: 'Catálogo, servicios y existencias', permission: 'products.read', mobilePriority: 40 },
      { key: 'categories', label: 'Categorías', href: '/dashboard/categories', icon: Tags, description: 'Organización del catálogo', permission: 'products.read' },
      { key: 'brands', label: 'Marcas', href: '/dashboard/brands', icon: BadgeCheck, description: 'Marcas del catálogo', permission: 'products.manage' },
      { key: 'inventory-count', label: 'Toma de inventario', href: '/dashboard/inventory-count', icon: ScanBarcode, description: 'Contar, ver diferencias y ajustar', permission: 'products.read' },
      { key: 'expirations', label: 'Vencimientos', href: '/dashboard/vencimientos', icon: CalendarX2, description: 'Lotes vencidos o por vencer', permission: 'products.read' },
      { key: 'suppliers', label: 'Proveedores', href: '/dashboard/suppliers', icon: Truck, description: 'Compras y abastecimiento' },
    ],
  },
  {
    id: 'workshop',
    label: 'Taller',
    items: [
      { key: 'repairs', label: 'Reparaciones', href: '/dashboard/repairs', icon: Wrench, description: 'Órdenes y seguimiento', permission: 'repairs.read', mobilePriority: 50 },
      { key: 'repair-inventory', label: 'Inventario del taller', href: '/dashboard/repairs/inventory', icon: PackageSearch, description: 'Repuestos e insumos', permission: 'repairs.read' },
      { key: 'technician', label: 'Panel técnico', href: '/dashboard/technician', icon: ClipboardCheck, description: 'Trabajo asignado a técnicos' },
    ],
  },
  {
    id: 'management',
    label: 'Análisis y gestión',
    items: [
      { key: 'pos-analytics', label: 'Analítica de ventas', href: '/dashboard/pos/dashboard', icon: ChartNoAxesCombined, description: 'Indicadores y rentabilidad' },
      { key: 'administration', label: 'Administración', href: '/admin', icon: Settings2, description: 'Configuración y gestión avanzada' },
    ],
  },
]

export const dashboardNavGroups: DashboardNavGroup[] = rawDashboardNavGroups.map((group) => ({
  ...group,
  items: group.items.map((item) => {
    const requirement = requirementForPath(item.href)
    return {
      ...item,
      module: requirement?.module ?? undefined,
      verticals: requirement?.verticals,
    }
  }),
}))

export function getDashboardNavItemByPath(pathname: string): DashboardNavItem | undefined {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/'

  return dashboardNavGroups
    .flatMap((group) => group.items)
    .filter((item) => (
      item.href === '/dashboard'
        ? path === item.href
        : path === item.href || path.startsWith(`${item.href}/`)
    ))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export function filterDashboardNavGroups({
  role,
  effectiveModules,
  hasPermission,
  businessVertical,
}: {
  role: UserRole | undefined
  effectiveModules: readonly string[]
  hasPermission: (permission: string) => boolean
  /** Sin rubro conocido todavía, se muestra todo. */
  businessVertical?: string | null
}): DashboardNavGroup[] {
  return dashboardNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!isNavigationModuleAvailable(item.module, effectiveModules)) return false
        if (item.verticals?.length && businessVertical && !item.verticals.includes(businessVertical)) return false
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
