import {
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  Headphones,
  LockKeyhole,
  MessageCircle,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export type SaaSFeature = {
  title: string
  description: string
  icon: LucideIcon
  tone: string
}

export type SaaSBusinessType = {
  title: string
  description: string
  metrics: string
  /** Módulos activos sugeridos para este tipo de negocio */
  modules: string[]
  /** Frase corta de cuándo encaja bien */
  fit: string
  /** Resultado operativo esperado */
  result: string
  /** Plan recomendado */
  plan: string
  icon: LucideIcon
  color: string
  accentBg: string
  iconBg: string
  /** Tone para badges y bordes coloreados (Tailwind classes) */
  tone: string
}

export type SaaSPlan = {
  id?: string
  tier?: string
  name: string
  price: number
  priceFormatted?: string
  yearlyPrice?: number
  custom?: boolean
  description: string
  badge?: string
  cta: string
  featured?: boolean
  is_popular?: boolean
  limits: {
    users?: string
    products?: string
    branches?: string
    repairs?: string
    storage?: string
  }
  highlights: string[]
  modules: string[]
}

export const platformStats = [
  { label: 'Ventas procesadas', value: '+50.000', detail: 'en el último mes' },
  { label: 'Productos y servicios', value: '+15.000', detail: 'en catálogo' },
  { label: 'Reparaciones gestionadas', value: '+8.500', detail: 'con seguimiento' },
  { label: 'Disponibilidad de red', value: '99.9%', detail: 'uptime garantizado' },
]

export const socialProof = [
  { value: '500+', label: 'Empresas activas' },
  { value: '15k+', label: 'Productos y servicios' },
  { value: '99.9%', label: 'Disponibilidad' },
  { value: '4.9★', label: 'Calificación promedio' },
]

export const trustItems = [
  { label: 'Aislamiento 100% por empresa', icon: LockKeyhole },
  { label: 'Roles y permisos granulares', icon: ShieldCheck },
  { label: 'POS, inventario y reparaciones conectados', icon: CheckCircle2 },
]

export const features: SaaSFeature[] = [
  {
    title: 'POS y Caja en Mostrador',
    description: 'Ventas rápidas y fluidas, turnos de caja, tickets, auditoría y arqueo diario.',
    icon: ShoppingCart,
    tone: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30',
  },
  {
    title: 'Inventario de Productos & Servicios',
    description: 'Control estricto de existencias físicas junto con gestión de servicios profesionales y mano de obra sin límite de stock.',
    icon: Boxes,
    tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    title: 'Taller & Órdenes de Reparación',
    description: 'Recepción técnica, diagnóstico, repuestos utilizados, estados en tiempo real y portal público de consulta para clientes.',
    icon: Wrench,
    tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  },
  {
    title: 'Ecommerce & Catálogo Público',
    description: 'Tienda online propia por empresa, sincronizada en tiempo real con el stock físico del punto de venta.',
    icon: Store,
    tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30',
  },
  {
    title: 'Clientes y CRM Comercial',
    description: 'Historial de compras, cuentas corrientes, recordatorios y seguimiento comercial post-venta.',
    icon: MessageCircle,
    tone: 'text-green-600 bg-green-50 dark:bg-green-950/30',
  },
  {
    title: 'Delivery y Control de Despacho',
    description: 'Gestión de envíos locales, preparación de pedidos de mostrador y seguimiento de entrega.',
    icon: Truck,
    tone: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30',
  },
  {
    title: 'Analytics & Reportes Exportables',
    description: 'Métricas de rentabilidad, productos más vendidos, rendimiento por sucursal y exportación en CSV/PDF.',
    icon: BarChart3,
    tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  },
  {
    title: 'Promociones, Cupones & Descuentos',
    description: 'Campañas de fidelización, códigos de activación, cupones temporales y reglas de descuento por cliente.',
    icon: Tag,
    tone: 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30',
  },
]

export const businessTypes: SaaSBusinessType[] = [
  {
    title: 'Tiendas de Retail & Tecnología',
    description: 'Venta de productos electrónicos, accesorios, celulares, indumentaria con control de existencias, código de barras y caja.',
    metrics: 'POS + Inventario físico + Catálogo',
    modules: ['POS Mostrador', 'Control de Stock', 'Catálogo Web', 'Clientes'],
    fit: 'Ideal para negocios con mostrador y alto volumen de venta diaria.',
    result: 'Cero discrepancias de caja y control exacto de stock.',
    plan: 'BASIC o PRO',
    icon: Store,
    color: 'text-cyan-600 dark:text-cyan-400',
    accentBg: 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-900/30',
    iconBg: 'bg-cyan-100 dark:bg-cyan-950/50',
    tone: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300',
  },
  {
    title: 'Servicios Técnicos & Talleres',
    description: 'Órdenes de servicio técnico, asignación de técnicos, repuestos vinculados y consulta de estado en línea.',
    metrics: 'Reparaciones + Servicios + Historial',
    modules: ['Reparaciones', 'Servicios Profesionales', 'Presupuestos', 'Avisos y Seguimiento'],
    fit: 'Ideal para talleres mecánicos, electrónica, celulares y service oficial.',
    result: 'Clientes informados en tiempo real y menos llamadas de consulta.',
    plan: 'BASIC o PRO',
    icon: Wrench,
    color: 'text-amber-600 dark:text-amber-400',
    accentBg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30',
    iconBg: 'bg-amber-100 dark:bg-amber-950/50',
    tone: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  },
  {
    title: 'Cadenas Multi-sucursal',
    description: 'Gestión centralizada de múltiples sucursales con inventarios independientes, transferencias entre depósitos y permisos por rol.',
    metrics: 'Multi-sucursal + Analytics centralizado',
    modules: ['Sucursales Ilimitadas', 'Transferencias de Stock', 'Roles Granulares', 'Auditoría'],
    fit: 'Ideal para empresas con 2 o más locales comerciales.',
    result: 'Visibilidad consolidada en tiempo real de toda la operación.',
    plan: 'PRO o ENTERPRISE',
    icon: Building2,
    color: 'text-violet-600 dark:text-violet-400',
    accentBg: 'bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/30',
    iconBg: 'bg-violet-100 dark:bg-violet-950/50',
    tone: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  },
  {
    title: 'Negocios con Ecommerce & Delivery',
    description: 'Publicación de productos y servicios en tienda online propia, recepción de pedidos y despacho local.',
    metrics: 'Catálogo online + Carrito + Despachos',
    modules: ['Tienda Ecommerce', 'Gestión de Pedidos', 'Envíos & Delivery', 'Catálogo Sincronizado'],
    fit: 'Ideal para comercios que venden tanto en tienda física como por internet.',
    result: 'Ventas omnicanal con stock 100% sincronizado automáticamente.',
    plan: 'PRO o ENTERPRISE',
    icon: Truck,
    color: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30',
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  },
]

export const workflowSteps = [
  { title: '1. Registrá tu organización', description: 'Creá tu empresa, personalizá tu logo, moneda y configurá tus datos fiscales.', icon: Building2 },
  { title: '2. Cargá productos y servicios', description: 'Importá tu inventario físico y catálogo de servicios con precios y categorías.', icon: Boxes },
  { title: '3. Operá y hacé crecer tu negocio', description: 'Vendé en caja, atendé reparaciones técnicas, gestioná pedidos y consultá métricas en vivo.', icon: ReceiptText },
]

/** Planes oficiales sincronizados con PLAN_LIMITS del sistema */
export const defaultSyncPlans: SaaSPlan[] = [
  {
    id: 'plan-free',
    tier: 'free',
    name: 'FREE',
    price: 0,
    priceFormatted: 'Gs. 0',
    description: 'Para emprendedores y pequeños negocios que quieren comenzar a digitalizar su punto de venta.',
    cta: 'Empezar gratis',
    featured: false,
    is_popular: false,
    limits: {
      users: '2 usuarios',
      products: '100 ítems',
      branches: '1 sucursal',
      repairs: '10 / mes',
    },
    highlights: [
      'Hasta 2 usuarios concurrentes',
      'Hasta 100 productos y servicios',
      '1 sucursal comercial',
      'Punto de Venta (POS) y caja diaria',
      'Gestión de clientes y contactos',
      'Catálogo público básico',
    ],
    modules: ['pos', 'inventory', 'crm'],
  },
  {
    id: 'plan-basic',
    tier: 'basic',
    name: 'BASIC',
    price: 150000,
    priceFormatted: 'Gs. 150.000',
    yearlyPrice: 120000,
    description: 'Para negocios en crecimiento que necesitan control de stock, turnos de caja y módulo de reparaciones.',
    badge: 'Más Popular',
    cta: 'Elegir Plan Basic',
    featured: true,
    is_popular: true,
    limits: {
      users: '5 usuarios',
      products: '1.000 ítems',
      branches: '1 sucursal',
      repairs: '100 / mes',
    },
    highlights: [
      'Hasta 5 usuarios con roles asignados',
      'Hasta 1.000 productos y servicios',
      'Módulo de Reparaciones & Taller técnico',
      'Inventario avanzado y movimientos de stock',
      'Reportes exportables en CSV y PDF',
      'CRM con historial de compras',
    ],
    modules: ['pos', 'inventory', 'inventory_admin', 'repairs', 'crm'],
  },
  {
    id: 'plan-pro',
    tier: 'pro',
    name: 'PRO',
    price: 350000,
    priceFormatted: 'Gs. 350.000',
    yearlyPrice: 280000,
    description: 'Para empresas consolidadas con múltiples sucursales, tienda ecommerce y análisis de rentabilidad.',
    cta: 'Elegir Plan Pro',
    featured: false,
    is_popular: false,
    limits: {
      users: '20 usuarios',
      products: '10.000 ítems',
      branches: '5 sucursales',
      repairs: 'Ilimitadas',
    },
    highlights: [
      'Hasta 20 usuarios y cajeros',
      'Hasta 10.000 productos y servicios',
      'Hasta 5 sucursales interconectadas',
      'Ecommerce propio & Marketplace sincronizado',
      'Analytics avanzado y métricas financieras',
      'Promociones, cupones y descuentos',
      'Auditoría y seguridad avanzada',
    ],
    modules: ['pos', 'inventory', 'inventory_admin', 'repairs', 'crm', 'ecommerce', 'analytics', 'promotions', 'security'],
  },
  {
    id: 'plan-enterprise',
    tier: 'enterprise',
    name: 'ENTERPRISE',
    price: 0,
    priceFormatted: 'A Medida',
    custom: true,
    description: 'Para cadenas comerciales con múltiples locales, altos volúmenes operativos y soporte prioritario 24/7.',
    cta: 'Contactar a Ventas',
    featured: false,
    is_popular: false,
    limits: {
      users: 'Ilimitados',
      products: 'Ilimitados',
      branches: 'Ilimitadas',
      repairs: 'Ilimitadas',
    },
    highlights: [
      'Usuarios y sucursales sin límites',
      'Productos físicos y servicios ilimitados',
      'Módulo completo de Delivery y despachos',
      'Configuración adaptada a la operación',
      'SLA garantizado del 99.9%',
      'Soporte técnico y onboarding prioritario',
    ],
    modules: ['pos', 'inventory', 'inventory_admin', 'repairs', 'crm', 'ecommerce', 'delivery', 'analytics', 'promotions', 'security'],
  },
]

export const plans = defaultSyncPlans

export const planNotes = [
  { title: 'Aislamiento estricto de datos', description: 'Cada empresa opera sobre un entorno 100% aislado por organización.' },
  { title: 'Operación centralizada', description: 'Gestioná ventas, inventario, clientes y reparaciones desde una sola plataforma.' },
  { title: 'Escalabilidad sin fricción', description: 'Cambiá de plan o agregá sucursales cuando tu negocio lo necesite sin perder datos.' },
]

export const supportItems = [
  { title: 'Onboarding y migración asistida', icon: Headphones },
  { title: 'Seguridad bancaria con RLS', icon: ShieldCheck },
  { title: 'Catálogo de productos y servicios', icon: Package },
  { title: 'Flujo de caja y reparaciones en vivo', icon: CheckCircle2 },
]
