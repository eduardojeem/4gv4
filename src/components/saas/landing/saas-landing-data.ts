import {
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  CreditCard,
  Headphones,
  LockKeyhole,
  MessageCircle,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  Users,
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
  icon: LucideIcon
  color: string
  accentBg: string
  iconBg: string
}

export type SaaSPlan = {
  name: string
  price: string
  yearlyPrice?: string
  custom?: boolean
  description: string
  badge?: string
  cta: string
  featured?: boolean
  limits: string[]
  modules: string[]
}

export const platformStats = [
  { label: 'Ventas procesadas', value: '42', detail: 'hoy' },
  { label: 'Productos activos', value: '1.248', detail: 'catálogo' },
  { label: 'Reparaciones', value: '16', detail: 'en curso' },
  { label: 'Sucursales', value: '3', detail: 'conectadas' },
]

export const socialProof = [
  { value: '500+', label: 'Empresas activas' },
  { value: '12k+', label: 'Productos publicados' },
  { value: '99%', label: 'Disponibilidad' },
  { value: '4.9★', label: 'Calificación promedio' },
]

export const trustItems = [
  { label: 'Aislamiento por empresa', icon: LockKeyhole },
  { label: 'Roles y permisos', icon: ShieldCheck },
  { label: 'Planes y límites', icon: CreditCard },
]

export const features: SaaSFeature[] = [
  {
    title: 'POS y caja',
    description: 'Ventas rápidas, pagos, turnos de caja, auditoría y operación por sucursal.',
    icon: ShoppingCart,
    tone: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30',
  },
  {
    title: 'Inventario multi-sucursal',
    description: 'Productos, categorías, marcas, proveedores, stock mínimo y movimientos.',
    icon: Boxes,
    tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    title: 'Reparaciones',
    description: 'Órdenes técnicas, diagnóstico, técnicos asignados y seguimiento público.',
    icon: Wrench,
    tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  },
  {
    title: 'Catálogo y ecommerce',
    description: 'Página propia por empresa, productos públicos, categorías y detalle de producto.',
    icon: Store,
    tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30',
  },
  {
    title: 'WhatsApp y clientes',
    description: 'Contacto comercial, avisos de reparación y base CRM para compradores.',
    icon: MessageCircle,
    tone: 'text-green-600 bg-green-50 dark:bg-green-950/30',
  },
  {
    title: 'Delivery y pedidos',
    description: 'Base operativa para preparar pedidos, despachos y entregas locales.',
    icon: Truck,
    tone: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30',
  },
  {
    title: 'Analytics',
    description: 'Métricas de ventas, productos, sucursales, uso de plan y crecimiento.',
    icon: BarChart3,
    tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  },
  {
    title: 'Marketplace global',
    description: 'Empresas, productos y categorías globales sin mezclar datos internos.',
    icon: ShoppingBag,
    tone: 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30',
  },
]

export const businessTypes: SaaSBusinessType[] = [
  {
    title: 'Tiendas de celulares',
    description: 'Venta de celulares, accesorios, repuestos, control de stock y caja diaria.',
    metrics: 'POS + inventario + catálogo',
    icon: Store,
    color: 'text-cyan-600 dark:text-cyan-400',
    accentBg: 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-900/30',
    iconBg: 'bg-cyan-100 dark:bg-cyan-950/50',
  },
  {
    title: 'Servicios técnicos',
    description: 'Órdenes de reparación, estados, técnicos, historial y seguimiento por ticket.',
    metrics: 'Reparaciones + WhatsApp',
    icon: Wrench,
    color: 'text-amber-600 dark:text-amber-400',
    accentBg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30',
    iconBg: 'bg-amber-100 dark:bg-amber-950/50',
  },
  {
    title: 'Cadenas y franquicias',
    description: 'Roles, sucursales, permisos, reportes y operaciones separadas por empresa.',
    metrics: 'Multi-sucursal + analytics',
    icon: Building2,
    color: 'text-violet-600 dark:text-violet-400',
    accentBg: 'bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/30',
    iconBg: 'bg-violet-100 dark:bg-violet-950/50',
  },
  {
    title: 'Negocios con delivery',
    description: 'Productos publicados, pedidos preparados y entregas para comercios locales.',
    metrics: 'Catálogo + delivery',
    icon: Truck,
    color: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30',
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
  },
]

export const workflowSteps = [
  { title: 'Registrá la empresa', description: 'Creá la organización, definí plan y prepará el branding.', icon: Building2 },
  { title: 'Cargá productos y equipo', description: 'Configurá sucursales, usuarios, roles y catálogo inicial.', icon: Users },
  { title: 'Vendé y operá', description: 'Usá POS, reparaciones, inventario, marketplace y reportes.', icon: ReceiptText },
]

export const plans: SaaSPlan[] = [
  {
    name: 'FREE',
    price: '0',
    yearlyPrice: '0',
    description: 'Para validar la plataforma con una empresa pequeña.',
    cta: 'Empezar gratis',
    limits: ['1 usuario', '50 productos', '1 sucursal', 'Almacenamiento base'],
    modules: ['POS base', 'Inventario base'],
  },
  {
    name: 'BASIC',
    price: '29',
    yearlyPrice: '24',
    description: 'Para negocios que necesitan ordenar ventas, stock y clientes.',
    badge: 'Recomendado',
    cta: 'Elegir Basic',
    featured: true,
    limits: ['3 usuarios', '500 productos', '2 sucursales', 'Reportes básicos'],
    modules: ['POS', 'Inventario', 'Clientes'],
  },
  {
    name: 'PRO',
    price: '79',
    yearlyPrice: '66',
    description: 'Para tiendas con reparaciones, catálogo público y comunicación activa.',
    cta: 'Elegir Pro',
    limits: ['10 usuarios', '5.000 productos', '5 sucursales', 'Automatizaciones'],
    modules: ['POS', 'Inventario', 'Repairs', 'Ecommerce', 'WhatsApp'],
  },
  {
    name: 'ENTERPRISE',
    price: 'Consultar',
    custom: true,
    description: 'Para operaciones multi-sucursal con soporte prioritario y límites a medida.',
    cta: 'Hablar con ventas',
    limits: ['Usuarios ilimitados', 'Productos ilimitados', 'Sucursales sin límite', 'SLA garantizado'],
    modules: ['Todos los módulos', 'Analytics', 'Marketplace', 'Integraciones'],
  },
]

export const planNotes = [
  { title: 'Sin mezclar empresas', description: 'Cada plan opera sobre datos aislados por organization_id.' },
  { title: 'Preparado para cobros', description: 'Arquitectura lista para Stripe, Pagopar y Bancard.' },
  { title: 'Escalable por módulo', description: 'Activá funciones según plan, permiso y madurez del negocio.' },
]

export const supportItems = [
  { title: 'Onboarding guiado', icon: Headphones },
  { title: 'Datos protegidos con RLS', icon: ShieldCheck },
  { title: 'Catálogo listo para marketplace', icon: Package },
  { title: 'Flujo de caja y reparaciones', icon: CheckCircle2 },
]
