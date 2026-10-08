/**
 * Textos del acceso de clientes (ingresar y registrarse) según lo que ofrece
 * la tienda. Antes eran fijos para un taller: una barbería o una tienda de
 * cosméticos le prometía al cliente «tus equipos», reparaciones y cuotas.
 */
export interface StoreCustomerFeatures {
  repairs: boolean
  credits: boolean
  orders: boolean
  services: boolean
}

export const ALL_STORE_CUSTOMER_FEATURES: StoreCustomerFeatures = { repairs: true, credits: true, orders: true, services: false }

export type CustomerAccessItemKey = 'repairs' | 'services' | 'payments' | 'credits' | 'orders'

const ITEMS: Record<CustomerAccessItemKey, { title: string; text: string }> = {
  repairs: { title: 'Reparaciones', text: 'Estado técnico en tiempo real y equipos listos.' },
  services: { title: 'Turnos', text: 'Tus reservas, cambios y próximas visitas.' },
  payments: { title: 'Pagos y recibos', text: 'Montos abonados, facturas y pendientes.' },
  credits: { title: 'Créditos en cuotas', text: 'Cuotas activas, vencimientos y saldo.' },
  orders: { title: 'Pedidos de compra', text: 'Historial de compras, retiro y delivery.' },
}

function joinList(parts: string[]) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0]
}

export function customerAccessCopy(features: StoreCustomerFeatures) {
  const keys: CustomerAccessItemKey[] = [
    ...(features.repairs ? ['repairs' as const] : []),
    ...(features.services ? ['services' as const] : []),
    'payments',
    ...(features.credits ? ['credits' as const] : []),
    ...(features.orders ? ['orders' as const] : []),
  ]
  const tracked = [
    ...(features.repairs ? ['tus reparaciones'] : []),
    ...(features.services ? ['tus turnos'] : []),
    ...(features.orders || (!features.repairs && !features.services) ? ['tus pedidos'] : []),
  ]
  return {
    headline: features.repairs
      ? 'Todo lo relacionado con tus equipos y pagos, en un solo lugar'
      : features.services
        ? 'Tus turnos y pagos, en un solo lugar'
        : 'Tus compras y pagos, en un solo lugar',
    items: keys.map((key) => ({ key, ...ITEMS[key] })),
    registerLead: `Con tu cuenta seguís ${joinList(tracked)} en esta tienda. Es gratis y toma un minuto.`,
    phoneHint: features.repairs
      ? 'Lo usamos para avisarte cuando tu reparación o tu pedido estén listos.'
      : features.services
        ? 'Lo usamos para confirmarte y recordarte tus turnos.'
        : 'Lo usamos para avisarte cuando tu pedido esté listo.',
    /** Adónde va después de ingresar si no pidió otra página. */
    defaultNextPath: features.repairs ? '/mis-reparaciones' : '/perfil',
  }
}
