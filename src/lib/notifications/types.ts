/**
 * Módulos requeridos para la disponibilidad de notificaciones.
 * Totalmente desacoplado de dependencias externas para compatibilidad universal (Web + Mobile).
 */
export type NotificationRequiredModule =
  | 'inventory'
  | 'inventory_admin'
  | 'pos'
  | 'crm'
  | 'orders'
  | 'ecommerce'
  | 'repairs'
  | 'services'
  | 'credits'
  | 'delivery'
  | 'analytics'
  | 'web_analytics'
  | 'promotions'
  | 'security'
  | 'finances'
  | 'reports'

/**
 * Permisos requeridos para recibir notificaciones restringidas.
 */
export type NotificationPermission =
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
  | 'repairs.orders.deliver'
  | 'crm.customers.read'
  | 'crm.customers.manage'
  | 'promotions.read'
  | 'promotions.create'
  | 'promotions.update'
  | 'promotions.delete'
  | 'promotions.manage'
  | 'ecommerce.orders.manage'
  | 'analytics.read'

/**
 * Catálogo central y fuertemente tipado de todos los tipos de eventos
 * que pueden generar una notificación en MiTiendaPy.
 */
export const NOTIFICATION_TYPES = [
  // Ventas (POS)
  'SALE_CREATED',
  'SALE_VOIDED',
  'SALE_RETURNED',
  'LARGE_SALE',

  // Pedidos
  'ORDER_CREATED',
  'ORDER_CONFIRMED',
  'ORDER_READY',
  'ORDER_CANCELLED',
  'ORDER_OVERDUE',
  'NEW_ONLINE_ORDER',

  // Reparaciones
  'REPAIR_CREATED',
  'REPAIR_ASSIGNED',
  'REPAIR_STATUS_CHANGED',
  'REPAIR_READY',
  'REPAIR_OVERDUE',
  'REPAIR_NOTE_ADDED',

  // Servicios / Reservas (Agenda)
  'BOOKING_CREATED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_RESCHEDULED',
  'BOOKING_REMINDER',
  'BOOKING_NO_SHOW',

  // Inventario
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'VARIANT_LOW_STOCK',
  'STOCK_ADJUSTMENT',

  // Caja
  'CASH_REGISTER_OPENED',
  'CASH_REGISTER_CLOSED',
  'CASH_DIFFERENCE',

  // Créditos / Pagos
  'CREDIT_PAYMENT_DUE',
  'CREDIT_OVERDUE',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',

  // Proveedores
  'PURCHASE_ORDER_RECEIVED',
  'PURCHASE_ORDER_DELAYED',
  'SUPPLIER_ORDER_STATUS_CHANGED',

  // Empleados / Administración
  'EMPLOYEE_INVITED',
  'ROLE_CHANGED',
  'PERMISSION_CHANGED',

  // Seguridad
  'NEW_LOGIN',
  'PASSWORD_CHANGED',

  // SaaS / Sistema
  'SUBSCRIPTION_EXPIRING',
  'SUBSCRIPTION_PAYMENT_FAILED',
  'PLAN_CHANGED',
  'IMPORTANT_SYSTEM_MESSAGE',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/**
 * Categorías de agrupación para la configuración de usuario y filtrado.
 */
export const NOTIFICATION_CATEGORIES = [
  'sales',
  'orders',
  'repairs',
  'services',
  'inventory',
  'cash',
  'credits',
  'suppliers',
  'employees',
  'security',
  'system',
] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  sales: {
    label: 'Ventas',
    description: 'Nuevas ventas, devoluciones y anulación de ventas.',
  },
  orders: {
    label: 'Pedidos',
    description: 'Nuevos pedidos, pedidos listos y cambios de estado.',
  },
  repairs: {
    label: 'Reparaciones',
    description: 'Asignaciones de trabajos técnicos y cambios de estado.',
  },
  services: {
    label: 'Reservas y servicios',
    description: 'Nuevos turnos agendados y recordatorios de citas.',
  },
  inventory: {
    label: 'Inventario',
    description: 'Alertas de stock bajo, agotados y ajustes.',
  },
  cash: {
    label: 'Caja',
    description: 'Aperturas, cierres y diferencias en arqueos.',
  },
  credits: {
    label: 'Créditos y pagos',
    description: 'Vencimientos de cuotas y confirmación de cobros.',
  },
  suppliers: {
    label: 'Proveedores',
    description: 'Recepción y seguimiento de órdenes de compra.',
  },
  employees: {
    label: 'Administración',
    description: 'Invitaciones, cambios de roles y permisos.',
  },
  security: {
    label: 'Seguridad',
    description: 'Inicios de sesión y cambios de contraseña.',
  },
  system: {
    label: 'Sistema y suscripción',
    description: 'Avisos del plan SaaS, facturación y mantenimiento.',
  },
}

/**
 * Estrategia de asignación de destinatarios para el evento.
 */
export type NotificationTarget =
  | 'assigned_user'      // Dirigida únicamente a un usuario específico (ej. técnico asignado)
  | 'role_permission'    // Miembros con rol/permiso habilitado (ej. tesorero para caja)
  | 'branch_members'     // Miembros asignados a la sucursal de la operación
  | 'all_members'        // Todos los miembros activos de la organización

/**
 * Canales de notificación soportados por la arquitectura.
 */
export type NotificationChannel = 'push' | 'in_app' | 'email' | 'sms' | 'whatsapp'

/**
 * Plataformas móviles soportadas para tokens de dispositivo.
 */
export type PushPlatform = 'ios' | 'android' | 'web'

/**
 * Definición completa de metadata por tipo de evento.
 */
export interface NotificationEventMetadata {
  type: NotificationType
  category: NotificationCategory
  title: string
  /** Módulo requerido en organizations.enabled_modules (null = universal/siempre activo) */
  requiredModule: NotificationRequiredModule | null
  /** Permiso requerido para poder recibir la notificación */
  requiredPermission: NotificationPermission | null
  /** Si es una notificación personal a un usuario específico */
  personal: boolean
  target: NotificationTarget
  /** Si el evento respeta la sucursal donde ocurrió la acción */
  supportsBranchScope: boolean
  /** Ruta sugerida para el deep link de navegación segura */
  defaultRoutePattern: string | null
  /** Valor predeterminado de Push (puede depender del rol) */
  defaultPush: boolean
  /** Valor predeterminado In-App */
  defaultInApp: boolean
}

/**
 * Registro exhaustivo de metadatos de todos los tipos de notificación.
 */
export const NOTIFICATION_METADATA: Record<NotificationType, NotificationEventMetadata> = {
  // Ventas (POS)
  SALE_CREATED: {
    type: 'SALE_CREATED',
    category: 'sales',
    title: 'Nueva venta',
    requiredModule: 'pos',
    requiredPermission: 'pos.sales.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/pos',
    defaultPush: true,
    defaultInApp: true,
  },
  SALE_VOIDED: {
    type: 'SALE_VOIDED',
    category: 'sales',
    title: 'Venta anulada',
    requiredModule: 'pos',
    requiredPermission: 'pos.sales.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/pos',
    defaultPush: true,
    defaultInApp: true,
  },
  SALE_RETURNED: {
    type: 'SALE_RETURNED',
    category: 'sales',
    title: 'Devolución registrada',
    requiredModule: 'pos',
    requiredPermission: 'pos.sales.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/pos',
    defaultPush: true,
    defaultInApp: true,
  },
  LARGE_SALE: {
    type: 'LARGE_SALE',
    category: 'sales',
    title: 'Venta destacada',
    requiredModule: 'pos',
    requiredPermission: 'pos.sales.read',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/pos',
    defaultPush: true,
    defaultInApp: true,
  },

  // Pedidos
  ORDER_CREATED: {
    type: 'ORDER_CREATED',
    category: 'orders',
    title: 'Nuevo pedido',
    requiredModule: 'orders',
    requiredPermission: 'ecommerce.orders.manage',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/orders/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  ORDER_CONFIRMED: {
    type: 'ORDER_CONFIRMED',
    category: 'orders',
    title: 'Pedido confirmado',
    requiredModule: 'orders',
    requiredPermission: 'ecommerce.orders.manage',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/orders/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  ORDER_READY: {
    type: 'ORDER_READY',
    category: 'orders',
    title: 'Pedido listo para entrega',
    requiredModule: 'orders',
    requiredPermission: 'ecommerce.orders.manage',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/orders/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  ORDER_CANCELLED: {
    type: 'ORDER_CANCELLED',
    category: 'orders',
    title: 'Pedido cancelado',
    requiredModule: 'orders',
    requiredPermission: 'ecommerce.orders.manage',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/orders/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  ORDER_OVERDUE: {
    type: 'ORDER_OVERDUE',
    category: 'orders',
    title: 'Pedido atrasado',
    requiredModule: 'orders',
    requiredPermission: 'ecommerce.orders.manage',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/orders/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  NEW_ONLINE_ORDER: {
    type: 'NEW_ONLINE_ORDER',
    category: 'orders',
    title: 'Nuevo pedido online',
    requiredModule: 'ecommerce',
    requiredPermission: 'ecommerce.orders.manage',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/orders/[id]',
    defaultPush: true,
    defaultInApp: true,
  },

  // Reparaciones
  REPAIR_CREATED: {
    type: 'REPAIR_CREATED',
    category: 'repairs',
    title: 'Nueva reparación',
    requiredModule: 'repairs',
    requiredPermission: 'repairs.orders.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/repairs/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  REPAIR_ASSIGNED: {
    type: 'REPAIR_ASSIGNED',
    category: 'repairs',
    title: 'Reparación asignada',
    requiredModule: 'repairs',
    requiredPermission: 'repairs.orders.read',
    personal: true,
    target: 'assigned_user',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/repairs/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  REPAIR_STATUS_CHANGED: {
    type: 'REPAIR_STATUS_CHANGED',
    category: 'repairs',
    title: 'Cambio de estado en reparación',
    requiredModule: 'repairs',
    requiredPermission: 'repairs.orders.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/repairs/[id]',
    defaultPush: false,
    defaultInApp: true,
  },
  REPAIR_READY: {
    type: 'REPAIR_READY',
    category: 'repairs',
    title: 'Reparación lista',
    requiredModule: 'repairs',
    requiredPermission: 'repairs.orders.deliver',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/repairs/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  REPAIR_OVERDUE: {
    type: 'REPAIR_OVERDUE',
    category: 'repairs',
    title: 'Reparación atrasada',
    requiredModule: 'repairs',
    requiredPermission: 'repairs.orders.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/repairs/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  REPAIR_NOTE_ADDED: {
    type: 'REPAIR_NOTE_ADDED',
    category: 'repairs',
    title: 'Nueva nota en reparación',
    requiredModule: 'repairs',
    requiredPermission: 'repairs.orders.read',
    personal: true,
    target: 'assigned_user',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/repairs/[id]',
    defaultPush: false,
    defaultInApp: true,
  },

  // Servicios / Reservas (Agenda)
  BOOKING_CREATED: {
    type: 'BOOKING_CREATED',
    category: 'services',
    title: 'Nueva reserva',
    requiredModule: 'services',
    requiredPermission: 'crm.customers.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/agenda',
    defaultPush: true,
    defaultInApp: true,
  },
  BOOKING_CONFIRMED: {
    type: 'BOOKING_CONFIRMED',
    category: 'services',
    title: 'Reserva confirmada',
    requiredModule: 'services',
    requiredPermission: 'crm.customers.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/agenda',
    defaultPush: true,
    defaultInApp: true,
  },
  BOOKING_CANCELLED: {
    type: 'BOOKING_CANCELLED',
    category: 'services',
    title: 'Reserva cancelada',
    requiredModule: 'services',
    requiredPermission: 'crm.customers.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/agenda',
    defaultPush: true,
    defaultInApp: true,
  },
  BOOKING_RESCHEDULED: {
    type: 'BOOKING_RESCHEDULED',
    category: 'services',
    title: 'Reserva reprogramada',
    requiredModule: 'services',
    requiredPermission: 'crm.customers.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/agenda',
    defaultPush: true,
    defaultInApp: true,
  },
  BOOKING_REMINDER: {
    type: 'BOOKING_REMINDER',
    category: 'services',
    title: 'Recordatorio de turno',
    requiredModule: 'services',
    requiredPermission: 'crm.customers.read',
    personal: true,
    target: 'assigned_user',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/agenda',
    defaultPush: true,
    defaultInApp: true,
  },
  BOOKING_NO_SHOW: {
    type: 'BOOKING_NO_SHOW',
    category: 'services',
    title: 'Inasistencia a reserva',
    requiredModule: 'services',
    requiredPermission: 'crm.customers.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/agenda',
    defaultPush: false,
    defaultInApp: true,
  },

  // Inventario
  LOW_STOCK: {
    type: 'LOW_STOCK',
    category: 'inventory',
    title: 'Stock bajo detectado',
    requiredModule: 'inventory',
    requiredPermission: 'products.read',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/products?filter=low_stock',
    defaultPush: false,
    defaultInApp: true,
  },
  OUT_OF_STOCK: {
    type: 'OUT_OF_STOCK',
    category: 'inventory',
    title: 'Producto agotado',
    requiredModule: 'inventory',
    requiredPermission: 'products.read',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/products?filter=out_of_stock',
    defaultPush: false,
    defaultInApp: true,
  },
  VARIANT_LOW_STOCK: {
    type: 'VARIANT_LOW_STOCK',
    category: 'inventory',
    title: 'Stock bajo en variante',
    requiredModule: 'inventory',
    requiredPermission: 'products.read',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/products?filter=low_stock',
    defaultPush: false,
    defaultInApp: true,
  },
  STOCK_ADJUSTMENT: {
    type: 'STOCK_ADJUSTMENT',
    category: 'inventory',
    title: 'Ajuste de inventario',
    requiredModule: 'inventory_admin',
    requiredPermission: 'inventory.stock.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/products',
    defaultPush: false,
    defaultInApp: true,
  },

  // Caja
  CASH_REGISTER_OPENED: {
    type: 'CASH_REGISTER_OPENED',
    category: 'cash',
    title: 'Apertura de caja',
    requiredModule: 'pos',
    requiredPermission: 'pos.cash.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/cash-register',
    defaultPush: false,
    defaultInApp: true,
  },
  CASH_REGISTER_CLOSED: {
    type: 'CASH_REGISTER_CLOSED',
    category: 'cash',
    title: 'Cierre de caja',
    requiredModule: 'pos',
    requiredPermission: 'pos.cash.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/cash-register',
    defaultPush: true,
    defaultInApp: true,
  },
  CASH_DIFFERENCE: {
    type: 'CASH_DIFFERENCE',
    category: 'cash',
    title: 'Diferencia en arqueo de caja',
    requiredModule: 'pos',
    requiredPermission: 'pos.cash.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/cash-register',
    defaultPush: true,
    defaultInApp: true,
  },

  // Créditos / Pagos
  CREDIT_PAYMENT_DUE: {
    type: 'CREDIT_PAYMENT_DUE',
    category: 'credits',
    title: 'Vencimiento de cuota',
    requiredModule: 'credits',
    requiredPermission: 'pos.sales.read',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/credits/[id]',
    defaultPush: false,
    defaultInApp: true,
  },
  CREDIT_OVERDUE: {
    type: 'CREDIT_OVERDUE',
    category: 'credits',
    title: 'Cuota de crédito vencida',
    requiredModule: 'credits',
    requiredPermission: 'pos.sales.read',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/credits/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  PAYMENT_RECEIVED: {
    type: 'PAYMENT_RECEIVED',
    category: 'credits',
    title: 'Pago recibido',
    requiredModule: 'credits',
    requiredPermission: 'pos.sales.read',
    personal: false,
    target: 'branch_members',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/credits/[id]',
    defaultPush: true,
    defaultInApp: true,
  },
  PAYMENT_FAILED: {
    type: 'PAYMENT_FAILED',
    category: 'credits',
    title: 'Fallo en procesamiento de pago',
    requiredModule: 'credits',
    requiredPermission: 'pos.sales.read',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/credits/[id]',
    defaultPush: true,
    defaultInApp: true,
  },

  // Proveedores
  PURCHASE_ORDER_RECEIVED: {
    type: 'PURCHASE_ORDER_RECEIVED',
    category: 'suppliers',
    title: 'Orden de compra recibida',
    requiredModule: 'inventory_admin',
    requiredPermission: 'inventory.stock.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/suppliers',
    defaultPush: false,
    defaultInApp: true,
  },
  PURCHASE_ORDER_DELAYED: {
    type: 'PURCHASE_ORDER_DELAYED',
    category: 'suppliers',
    title: 'Orden de compra demorada',
    requiredModule: 'inventory_admin',
    requiredPermission: 'inventory.stock.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/suppliers',
    defaultPush: false,
    defaultInApp: true,
  },
  SUPPLIER_ORDER_STATUS_CHANGED: {
    type: 'SUPPLIER_ORDER_STATUS_CHANGED',
    category: 'suppliers',
    title: 'Estado de compra actualizado',
    requiredModule: 'inventory_admin',
    requiredPermission: 'inventory.stock.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: true,
    defaultRoutePattern: '/panel/suppliers',
    defaultPush: false,
    defaultInApp: true,
  },

  // Empleados / Administración
  EMPLOYEE_INVITED: {
    type: 'EMPLOYEE_INVITED',
    category: 'employees',
    title: 'Nuevo empleado invitado',
    requiredModule: null,
    requiredPermission: 'users.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: false,
    defaultRoutePattern: '/admin/users',
    defaultPush: false,
    defaultInApp: true,
  },
  ROLE_CHANGED: {
    type: 'ROLE_CHANGED',
    category: 'employees',
    title: 'Cambio de rol',
    requiredModule: null,
    requiredPermission: null,
    personal: true,
    target: 'assigned_user',
    supportsBranchScope: false,
    defaultRoutePattern: '/panel',
    defaultPush: true,
    defaultInApp: true,
  },
  PERMISSION_CHANGED: {
    type: 'PERMISSION_CHANGED',
    category: 'employees',
    title: 'Permisos actualizados',
    requiredModule: null,
    requiredPermission: null,
    personal: true,
    target: 'assigned_user',
    supportsBranchScope: false,
    defaultRoutePattern: '/panel',
    defaultPush: true,
    defaultInApp: true,
  },

  // Seguridad
  NEW_LOGIN: {
    type: 'NEW_LOGIN',
    category: 'security',
    title: 'Nuevo inicio de sesión',
    requiredModule: null,
    requiredPermission: null,
    personal: true,
    target: 'assigned_user',
    supportsBranchScope: false,
    defaultRoutePattern: '/panel',
    defaultPush: true,
    defaultInApp: true,
  },
  PASSWORD_CHANGED: {
    type: 'PASSWORD_CHANGED',
    category: 'security',
    title: 'Contraseña actualizada',
    requiredModule: null,
    requiredPermission: null,
    personal: true,
    target: 'assigned_user',
    supportsBranchScope: false,
    defaultRoutePattern: '/panel',
    defaultPush: true,
    defaultInApp: true,
  },

  // SaaS / Sistema
  SUBSCRIPTION_EXPIRING: {
    type: 'SUBSCRIPTION_EXPIRING',
    category: 'system',
    title: 'Suscripción próxima a vencer',
    requiredModule: null,
    requiredPermission: 'billing.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: false,
    defaultRoutePattern: '/admin/subscriptions',
    defaultPush: true,
    defaultInApp: true,
  },
  SUBSCRIPTION_PAYMENT_FAILED: {
    type: 'SUBSCRIPTION_PAYMENT_FAILED',
    category: 'system',
    title: 'Fallo en pago de suscripción',
    requiredModule: null,
    requiredPermission: 'billing.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: false,
    defaultRoutePattern: '/admin/subscriptions',
    defaultPush: true,
    defaultInApp: true,
  },
  PLAN_CHANGED: {
    type: 'PLAN_CHANGED',
    category: 'system',
    title: 'Plan del negocio actualizado',
    requiredModule: null,
    requiredPermission: 'billing.manage',
    personal: false,
    target: 'role_permission',
    supportsBranchScope: false,
    defaultRoutePattern: '/admin/subscriptions',
    defaultPush: true,
    defaultInApp: true,
  },
  IMPORTANT_SYSTEM_MESSAGE: {
    type: 'IMPORTANT_SYSTEM_MESSAGE',
    category: 'system',
    title: 'Comunicado del sistema',
    requiredModule: null,
    requiredPermission: null,
    personal: false,
    target: 'all_members',
    supportsBranchScope: false,
    defaultRoutePattern: '/panel',
    defaultPush: true,
    defaultInApp: true,
  },
}

/**
 * Representación en base de datos de un dispositivo push registrado.
 */
export interface PushDevice {
  id: string
  userId: string
  organizationId: string
  deviceId: string
  platform: PushPlatform
  pushToken: string
  enabled: boolean
  appVersion: string | null
  lastSeenAt: string
  createdAt: string
  updatedAt: string
}

/**
 * Representación en base de datos de una preferencia de usuario por tipo de evento.
 */
export interface NotificationPreference {
  id: string
  organizationId: string
  userId: string
  notificationType: NotificationType
  pushEnabled: boolean
  inAppEnabled: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Representación en base de datos de un registro de notificación persistida.
 */
export interface NotificationRecord {
  id: string
  organizationId: string
  branchId: string | null
  userId: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, unknown>
  resourceType: string | null
  resourceId: string | null
  readAt: string | null
  idempotencyKey: string | null
  createdAt: string
}

/**
 * Obtiene la metadata configurada para un tipo de evento específico del catálogo.
 */
export function getNotificationMetadata(type: NotificationType): NotificationEventMetadata {
  const metadata = NOTIFICATION_METADATA[type]
  if (!metadata) {
    throw new Error(`Tipo de notificación no registrado en el catálogo: ${String(type)}`)
  }
  return metadata
}

/**
 * Parámetros requeridos para despachar un evento de negocio al sistema de notificaciones.
 */
export interface NotificationPayload {
  organizationId: string
  branchId?: string | null
  type: NotificationType
  title?: string
  body: string
  data?: Record<string, unknown>
  resourceType?: string | null
  resourceId?: string | null
  targetUserId?: string | null
  idempotencyKey?: string | null
}
