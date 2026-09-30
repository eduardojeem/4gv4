/**
 * Features de los planes: una sola lista para el editor, la matriz, el detalle
 * y la sincronización con módulos (plan-modules.ts).
 *
 * Antes cada pantalla tenía su copia con nombres distintos ("CRM / Clientes"
 * en una, "CRM / Gestión de clientes" en otra) y ninguna decía cuáles
 * habilitan algo y cuáles son solo texto de venta.
 *
 * `label` es el nombre que se guarda en `subscription_plans.features` y el que
 * lee el trigger de la base: cambiarlo exige actualizar también la función
 * `sync_technical_plan_from_subscription_plan`.
 */

export type PlanFeatureGroup = 'venta' | 'operacion' | 'gestion' | 'servicio'

export type PlanFeatureDefinition = {
  key: string
  label: string
  /** Módulo que habilita; null = se muestra en la venta pero no habilita nada. */
  module: string | null
  group: PlanFeatureGroup
  /** Qué significa para la tienda, en una línea. */
  hint: string
}

export const PLAN_FEATURE_GROUP_LABEL: Record<PlanFeatureGroup, string> = {
  venta: 'Venta y tienda online',
  operacion: 'Operación',
  gestion: 'Gestión y control',
  servicio: 'Servicio',
}

export const PLAN_FEATURES: readonly PlanFeatureDefinition[] = [
  { key: 'pos', label: 'Punto de Venta (POS)', module: 'pos', group: 'venta', hint: 'Caja y ventas en el local' },
  { key: 'ecommerce', label: 'Ecommerce & Marketplace', module: 'ecommerce', group: 'venta', hint: 'Tienda online y presencia en el marketplace' },
  { key: 'orders', label: 'Pedidos', module: 'orders', group: 'venta', hint: 'Carrito y pedidos online; sin esto la tienda atiende por WhatsApp' },
  { key: 'delivery', label: 'Entregas', module: 'delivery', group: 'venta', hint: 'Envíos a domicilio de los pedidos online' },
  { key: 'promotions', label: 'Promociones y descuentos', module: 'promotions', group: 'venta', hint: 'Cupones, descuentos y campañas' },
  { key: 'credits', label: 'Créditos y cuotas', module: 'credits', group: 'venta', hint: 'Ventas financiadas y cobranza en cuotas' },
  { key: 'inventory', label: 'Inventario', module: 'inventory', group: 'operacion', hint: 'Productos y stock' },
  { key: 'inventoryAdmin', label: 'Inventario avanzado', module: 'inventory_admin', group: 'operacion', hint: 'Proveedores, stock por sucursal y movimientos' },
  { key: 'repairs', label: 'Módulo de Reparaciones', module: 'repairs', group: 'operacion', hint: 'Órdenes de taller y seguimiento' },
  { key: 'services', label: 'Servicios', module: 'services', group: 'operacion', hint: 'Servicios que no son productos' },
  { key: 'crm', label: 'CRM / Gestión de clientes', module: 'crm', group: 'operacion', hint: 'Fichas e historial de clientes' },
  { key: 'analytics', label: 'Analytics avanzado', module: 'analytics', group: 'gestion', hint: 'Abre Analytics y Visitas web del panel' },
  { key: 'security', label: 'Seguridad y auditoría', module: 'security', group: 'gestion', hint: 'Abre Seguridad: accesos y auditoría de acciones' },
  { key: 'reports', label: 'Reportes exportables (CSV/PDF)', module: null, group: 'gestion', hint: 'Informativo: se habilita en cualquier plan pago' },
  { key: 'users', label: 'Gestión de usuarios', module: null, group: 'gestion', hint: 'Informativo: la cantidad la define el límite de usuarios' },
  { key: 'branches', label: 'Sucursales múltiples', module: null, group: 'gestion', hint: 'Informativo: la cantidad la define el límite de sucursales' },
  { key: 'support', label: 'Soporte prioritario', module: null, group: 'servicio', hint: 'Informativo: es un servicio, no una función de la app' },
]

export function planFeatureByKey(key: string): PlanFeatureDefinition | undefined {
  return PLAN_FEATURES.find((feature) => feature.key === key)
}
