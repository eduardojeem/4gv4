export type OrganizationRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'technician'
  | 'seller'
  | 'customer'

export type Permission =
  | 'organization.manage'
  | 'billing.manage'
  | 'users.manage'
  | 'settings.manage'
  | 'inventory.products.read'
  | 'inventory.products.create'
  | 'inventory.products.update'
  | 'inventory.products.delete'
  | 'inventory.stock.manage'
  | 'pos.sales.read'
  | 'pos.sales.create'
  | 'pos.cash.manage'
  | 'repairs.orders.read'
  | 'repairs.orders.create'
  | 'repairs.orders.update'
  | 'repairs.orders.assign'
  | 'crm.customers.read'
  | 'crm.customers.manage'
  | 'ecommerce.orders.manage'
  | 'analytics.read'

const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  owner: [
    'organization.manage',
    'billing.manage',
    'users.manage',
    'settings.manage',
    'inventory.products.read',
    'inventory.products.create',
    'inventory.products.update',
    'inventory.products.delete',
    'inventory.stock.manage',
    'pos.sales.read',
    'pos.sales.create',
    'pos.cash.manage',
    'repairs.orders.read',
    'repairs.orders.create',
    'repairs.orders.update',
    'repairs.orders.assign',
    'crm.customers.read',
    'crm.customers.manage',
    'ecommerce.orders.manage',
    'analytics.read',
  ],
  admin: [
    'users.manage',
    'settings.manage',
    'inventory.products.read',
    'inventory.products.create',
    'inventory.products.update',
    'inventory.products.delete',
    'inventory.stock.manage',
    'pos.sales.read',
    'pos.sales.create',
    'pos.cash.manage',
    'repairs.orders.read',
    'repairs.orders.create',
    'repairs.orders.update',
    'repairs.orders.assign',
    'crm.customers.read',
    'crm.customers.manage',
    'ecommerce.orders.manage',
    'analytics.read',
  ],
  manager: [
    'inventory.products.read',
    'inventory.products.create',
    'inventory.products.update',
    'inventory.stock.manage',
    'pos.sales.read',
    'pos.sales.create',
    'pos.cash.manage',
    'repairs.orders.read',
    'repairs.orders.create',
    'repairs.orders.update',
    'repairs.orders.assign',
    'crm.customers.read',
    'crm.customers.manage',
    'ecommerce.orders.manage',
    'analytics.read',
  ],
  cashier: ['inventory.products.read', 'pos.sales.read', 'pos.sales.create', 'pos.cash.manage', 'crm.customers.read'],
  technician: ['inventory.products.read', 'inventory.stock.manage', 'repairs.orders.read', 'repairs.orders.update'],
  seller: ['inventory.products.read', 'pos.sales.read', 'pos.sales.create', 'crm.customers.read', 'crm.customers.manage', 'ecommerce.orders.manage'],
  customer: ['repairs.orders.read'],
}

export function roleHasPermission(role: OrganizationRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function mapLegacyRoleToOrganizationRole(role?: string): OrganizationRole {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return 'admin'
    case 'vendedor':
      return 'seller'
    case 'tecnico':
      return 'technician'
    case 'cliente':
      return 'customer'
    default:
      return 'customer'
  }
}
