import type { OrganizationRole, Permission } from '@/lib/saas/permissions'
import { roleHasPermission } from '@/lib/saas/permissions'

const DASHBOARD_PERMISSION_MAP: Record<string, Permission[]> = {
  'products.read': ['products.read'],
  'products.create': ['products.create'],
  'products.update': ['products.update'],
  'products.delete': ['products.delete'],
  'products.manage': ['products.create', 'products.update', 'products.delete'],
  'inventory.read': ['products.read', 'inventory.stock.manage'],
  'inventory.update': ['inventory.stock.manage'],
  'inventory.manage': ['inventory.stock.manage'],
  'reports.read': ['analytics.read'],
  'reports.create': ['analytics.read'],
  'reports.manage': ['analytics.read'],
  'users.read': ['users.manage'],
  'users.create': ['users.manage'],
  'users.update': ['users.manage'],
  'users.delete': ['users.manage'],
  'users.manage': ['users.manage'],
  'settings.read': ['settings.manage'],
  'settings.update': ['settings.manage'],
  'settings.manage': ['settings.manage'],
  'promotions.read': ['promotions.read'],
  'promotions.create': ['promotions.create'],
  'promotions.update': ['promotions.update'],
  'promotions.delete': ['promotions.delete'],
  'promotions.manage': ['promotions.manage'],
  'pos.read': ['pos.sales.read', 'pos.sales.create'],
  'pos.manage': ['pos.cash.manage'],
  'prices.retail.read': ['products.read'],
  'customers.read': ['crm.customers.read'],
  'customers.update': ['crm.customers.manage'],
  'customers.manage': ['crm.customers.manage'],
  'orders.read': ['ecommerce.orders.manage'],
  'orders.manage': ['ecommerce.orders.manage'],
  'repairs.read': ['repairs.orders.read'],
  'repairs.manage': [
    'repairs.orders.create',
    'repairs.orders.update',
    'repairs.orders.assign',
  ],
}

export function getDashboardPermissionsForOrganizationRole(role: OrganizationRole): string[] {
  const permissions = Object.entries(DASHBOARD_PERMISSION_MAP)
    .filter(([, organizationPermissions]) =>
      organizationPermissions.some((permission) => roleHasPermission(role, permission))
    )
    .map(([dashboardPermission]) => dashboardPermission)

  if (['owner', 'admin', 'manager', 'seller'].includes(role)) {
    permissions.push('credits.read', 'credits.manage')
  }

  if (role === 'owner' || role === 'admin') {
    permissions.push(
      'products.read_cost',
      'products.read_wholesale_prices',
      'prices.cost.read',
      'prices.wholesale.read'
    )
  }

  return Array.from(new Set(permissions))
}
