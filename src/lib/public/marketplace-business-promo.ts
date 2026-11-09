export type BusinessPromoKind = 'commerce' | 'repairs' | 'services';
export const BUSINESS_PROMO_PROFILES = [
  { id: 'commerce', label: 'Comercios', title: 'Del mostrador a tu tienda online.', description: 'Vendé y controlá tu stock con más claridad.', benefits: [
    { icon: 'sales', title: 'Ventas y cobros', description: 'Ventas y medios de pago, a mano.' },
    { icon: 'stock', title: 'Inventario organizado', description: 'Productos, stock y variantes.' },
    { icon: 'catalog', title: 'Tu catálogo online', description: 'Productos y pedidos en tu tienda.' },
  ] },
  { id: 'repairs', label: 'Talleres', title: 'Cada equipo, con su seguimiento.', description: 'Organizá el trabajo desde la recepción hasta la entrega.', benefits: [
    { icon: 'repair', title: 'Órdenes de reparación', description: 'Equipos, diagnóstico y técnicos.' },
    { icon: 'sales', title: 'Presupuestos y cobros', description: 'Importes, pagos y saldos.' },
    { icon: 'warranty', title: 'Garantías e historial', description: 'Cobertura e historial del equipo.' },
  ] },
  { id: 'services', label: 'Servicios', title: 'Más orden para atender mejor.', description: 'Conectá los turnos con tus clientes y tus cobros.', benefits: [
    { icon: 'calendar', title: 'Agenda y reservas', description: 'Horarios y turnos organizados.' },
    { icon: 'customers', title: 'Clientes a mano', description: 'Datos e historial de atención.' },
    { icon: 'sales', title: 'Cobros y seguimiento', description: 'Estado del servicio y sus pagos.' },
  ] },
] as const;
export type BusinessPromoIcon = (typeof BUSINESS_PROMO_PROFILES)[number]['benefits'][number]['icon'];
export const BUSINESS_PROMO_LINKS = { web: { plans: '/saas#planes', system: '/saas#caracteristicas' }, mobile: { plans: '/saas/planes', system: '/saas/soluciones' } } as const;
