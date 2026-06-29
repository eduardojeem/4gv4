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
  | 'products.read'
  | 'products.create'
  | 'products.update'
  | 'products.delete'
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
  | 'promotions.read'
  | 'promotions.create'
  | 'promotions.update'
  | 'promotions.delete'
  | 'promotions.manage'
  | 'ecommerce.orders.manage'
  | 'analytics.read'

const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  owner: [
    'organization.manage',
    'billing.manage',
    'users.manage',
    'settings.manage',
    'products.read',
    'products.create',
    'products.update',
    'products.delete',
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
    'promotions.read',
    'promotions.create',
    'promotions.update',
    'promotions.delete',
    'promotions.manage',
    'ecommerce.orders.manage',
    'analytics.read',
  ],
  admin: [
    'users.manage',
    'settings.manage',
    'products.read',
    'products.create',
    'products.update',
    'products.delete',
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
    'promotions.read',
    'promotions.create',
    'promotions.update',
    'promotions.delete',
    'promotions.manage',
    'ecommerce.orders.manage',
    'analytics.read',
  ],
  manager: [
    'products.read',
    'products.create',
    'products.update',
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
    'promotions.read',
    'promotions.create',
    'promotions.update',
    'ecommerce.orders.manage',
    'analytics.read',
  ],
  cashier: ['products.read', 'pos.sales.read', 'pos.sales.create', 'pos.cash.manage', 'crm.customers.read'],
  technician: [
    'products.read',
    'inventory.stock.manage',
    'repairs.orders.read',
    'repairs.orders.update',
    // Acceso a POS / Caja / Clientes (acorde a la matriz de acceso por sección).
    'pos.sales.read',
    'pos.sales.create',
    'pos.cash.manage',
    'crm.customers.read',
  ],
  seller: [
    'products.read',
    'pos.sales.read',
    'pos.sales.create',
    'pos.cash.manage',
    'crm.customers.read',
    'crm.customers.manage',
    'promotions.read',
    'promotions.create',
    'promotions.update',
    'ecommerce.orders.manage',
    // Reparaciones: ver y registrar (crear). La gestión avanzada (asignar,
    // cambiar estado) queda para técnico/admin.
    'repairs.orders.read',
    'repairs.orders.create',
  ],
  customer: ['repairs.orders.read'],
}

export function roleHasPermission(role: OrganizationRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function mapLegacyRoleToOrganizationRole(role?: string): OrganizationRole {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'manager':
    case 'cashier':
    case 'technician':
    case 'seller':
    case 'customer':
      return role
    case 'super_admin':
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
