'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  Globe,
  HelpCircle,
  Layers,
  Lock,
  MapPin,
  Percent,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  Tags,
  Truck,
  UserRound,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnterSupportButton } from '@/components/superadmin/EnterSupportButton'
import { RobotGuide } from '@/components/common/RobotGuide'
import { EditOrganizationDialog, type EditableOrganization } from './EditOrganizationDialog'
import { cn } from '@/lib/utils'

export type FullOrganizationDetail = {
  organization: {
    id: string
    name: string
    slug: string
    plan: string
    logo_url: string | null
    owner_id: string | null
    created_at: string | null
    updated_at: string | null
    business_vertical?: string | null
    operating_model?: string | null
    enabled_modules?: string[] | null
  }
  owner: {
    id: string
    email: string | null
    full_name: string | null
    avatar_url: string | null
  } | null
  settings: {
    currency?: string | null
    timezone?: string | null
    display_name?: string | null
    tax_rate?: number | null
    invoice_prefix?: string | null
  } | null
  members: Array<{
    id: string
    user_id: string
    role: string
    status: string
    created_at: string | null
    profiles: {
      id: string
      email: string | null
      full_name: string | null
      avatar_url: string | null
    } | null
  }>
  subscription: {
    id: string
    plan: string
    status: string
    payment_status: string | null
    provider: string | null
    provider_customer_id: string | null
    provider_subscription_id: string | null
    current_period_starts_at: string | null
    current_period_ends_at: string | null
    trial_ends_at: string | null
    cancel_at_period_end: boolean
  } | null
  plan_details: {
    id: string
    name: string
    tier: string
    price_monthly?: number
    currency?: string
    limits?: Record<string, unknown>
    modules?: string[]
  } | null
  branches: Array<{
    id: string
    name: string
    code: string | null
    slug: string | null
    address: string | null
    city: string | null
    phone: string | null
    email: string | null
    is_active: boolean
    is_default: boolean
    created_at: string | null
  }>
  counts: {
    products: number
    sales: number
    customers: number
  }
}

type Props = {
  data: FullOrganizationDetail
}

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(val))
}

function formatMoney(amount: number | null | undefined, curr = 'PYG') {
  if (amount == null) return '—'
  if (curr === 'PYG') {
    return `Gs. ${Math.round(amount).toLocaleString('es-PY')}`
  }
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  }).format(amount)
}

function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null
  const target = new Date(dateStr).getTime()
  const now = Date.now()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

const PLAN_STYLES: Record<string, string> = {
  FREE: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  trialing: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300',
  past_due: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300',
  suspended: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
}

export const VERTICAL_DESCRIPTIONS: Record<string, { label: string; icon: string; desc: string; badge: string }> = {
  electronics: {
    label: 'Tecnología & Celulares',
    icon: '📱',
    desc: 'Venta de smartphones, accesorios, repuestos, informática y servicio técnico con trazabilidad de IMEI.',
    badge: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-300',
  },
  clothing: {
    label: 'Ropa, Calzados & Moda',
    icon: '👗',
    desc: 'Indumentaria, calzados y accesorios con gestión matricial de talles, colores y colecciones estacionales.',
    badge: 'border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-900/60 dark:bg-pink-950/40 dark:text-pink-300',
  },
  general: {
    label: 'Comercio General & Bazar',
    icon: '🏬',
    desc: 'Venta multirubro de artículos variados, compras rápidas en mostrador, promociones y catálogo web.',
    badge: 'border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  food: {
    label: 'Alimentos & Gastronomía',
    icon: '🍔',
    desc: 'Locales gastronómicos, cafeterías y minimarkets con despacho rápido, combos y control de pedidos.',
    badge: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  },
  cosmetics: {
    label: 'Cosmética & Belleza',
    icon: '💄',
    desc: 'Perfumerías, cuidado personal y estética con control de fechas de vencimiento y fidelización de clientes.',
    badge: 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300',
  },
  hardware: {
    label: 'Ferretería & Construcción',
    icon: '🔨',
    desc: 'Herramientas, materiales y electricidad con venta fraccionada, créditos a cuenta corriente y remisiones.',
    badge: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300',
  },
  other: {
    label: 'Otros Rubros Comerciales',
    icon: '🏷️',
    desc: 'Empresas y comercios especializados con catálogo adaptado a su nicho y operativa comercial.',
    badge: 'border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
}

export const MODULE_CATEGORIES = [
  {
    id: 'sales',
    title: '🛒 Ventas, Caja & Comercio Multicanal',
    description: 'Puntos de contacto para generar ingresos, facturación y cobros diarios',
    modules: [
      {
        key: 'pos',
        name: 'Punto de Venta (POS)',
        short: 'POS',
        icon: ShoppingBag,
        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
        summary: 'Caja rápida, emisión de tickets y comprobantes, múltiples medios de pago y arqueos.',
        capabilities: ['Cobros en efectivo / QR / tarjeta', 'Cierre ciego y arqueo de caja', 'Impresión térmica de tickets'],
      },
      {
        key: 'orders',
        name: 'Gestión de Pedidos',
        short: 'Pedidos',
        icon: ShoppingCart,
        color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800',
        summary: 'Control de pedidos pendientes, preparación, empaquetado y estados de despacho.',
        capabilities: ['Flujo de estados de entrega', 'Notas y especificaciones de pedido', 'Notificaciones de estado al cliente'],
      },
      {
        key: 'ecommerce',
        name: 'Tienda Online Pública',
        short: 'Tienda Web',
        icon: Globe,
        color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
        summary: 'Catálogo digital accesible en la web con carrito de compras y botón de WhatsApp.',
        capabilities: ['Subdominio público personalizado', 'Carrito con checkout por WhatsApp', 'Precios y stock sincronizados'],
      },
    ],
  },
  {
    id: 'inventory',
    title: '📦 Inventario, Almacén & Logística',
    description: 'Gestión de existencias, control de mermas y envíos a clientes',
    modules: [
      {
        key: 'inventory',
        name: 'Control de Stock & Existencias',
        short: 'Stock',
        icon: Boxes,
        color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
        summary: 'Entradas, salidas, ajustes de inventario y alertas automáticas de stock crítico.',
        capabilities: ['Alertas de reposición mínima', 'Variantes por color / tamaño / modelo', 'Importación masiva Excel'],
      },
      {
        key: 'inventory_admin',
        name: 'Inventario Avanzado & Costos',
        short: 'Stock Pro',
        icon: Layers,
        color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
        summary: 'Trazabilidad de lotes, transferencias entre sucursales y cálculo de márgenes reales.',
        capabilities: ['Transferencias inter-sucursales', 'Valorización de inventario por costo', 'Gestión de números de serie / IMEI'],
      },
      {
        key: 'delivery',
        name: 'Envíos & Logística de Delivery',
        short: 'Delivery',
        icon: Truck,
        color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
        summary: 'Asignación de repartidores, cálculo de costos de flete y control de entregas.',
        capabilities: ['Tarifas por zona / ciudad', 'Asignación a choferes / motos', 'Rastreo y comprobante de entrega'],
      },
    ],
  },
  {
    id: 'finance',
    title: '🤝 Clientes, Créditos & Finanzas',
    description: 'Relación con clientes, planes de pago y estrategias comerciales',
    modules: [
      {
        key: 'crm',
        name: 'Directorio de Clientes (CRM)',
        short: 'CRM',
        icon: Users,
        color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
        summary: 'Perfil 360° del cliente, historial de compras, notas y límites de crédito asignados.',
        capabilities: ['Historial completo de compras', 'Límite de crédito por cliente', 'Segmentación y notas'],
      },
      {
        key: 'credits',
        name: 'Créditos & Cuotas Propias',
        short: 'Cuotas',
        icon: Coins,
        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
        summary: 'Financiación directa del comercio, generación de pagarés y liquidación de cuotas.',
        capabilities: ['Plan de cuotas y fechas de vencimiento', 'Cálculo de intereses y recargo por mora', 'Recibos oficiales de cobro'],
      },
      {
        key: 'promotions',
        name: 'Promociones & Descuentos',
        short: 'Promos',
        icon: Tags,
        color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
        summary: 'Creación de cupones de descuento, combos 2x1 y campañas temporales de oferta.',
        capabilities: ['Códigos de cupón alfanuméricos', 'Descuentos porcentuales o fijos', 'Límites de uso por campaña'],
      },
    ],
  },
  {
    id: 'operations',
    title: '🛠️ Servicio Técnico & Prestaciones',
    description: 'Gestión de reparaciones, órdenes de trabajo y presupuestos',
    modules: [
      {
        key: 'repairs',
        name: 'Taller de Reparaciones & SAT',
        short: 'Taller SAT',
        icon: Wrench,
        color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
        summary: 'Recepción de equipos, checklist inicial, asignación a técnicos y garantías.',
        capabilities: ['Órdenes con código de seguimiento', 'Repuestos consumidos por reparación', 'Diagnóstico y entrega con garantía'],
      },
      {
        key: 'services',
        name: 'Servicios & Presupuestos',
        short: 'Servicios',
        icon: Sparkles,
        color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
        summary: 'Presupuestos formales para servicios profesionales y agendamiento de turnos.',
        capabilities: ['Cotizaciones en PDF imprimibles', 'Agenda de turnos y citas', 'Tarifario de mano de obra'],
      },
    ],
  },
  {
    id: 'control',
    title: '📊 Analítica, Seguridad & Control',
    description: 'Métricas de rendimiento directivo y auditoría de seguridad',
    modules: [
      {
        key: 'analytics',
        name: 'Analítica & KPIs Directivos',
        short: 'Analítica',
        icon: BarChart3,
        color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
        summary: 'Tableros ejecutivos con márgenes de ganancia, ranking de productos y flujo de caja.',
        capabilities: ['Reporte de ventas por vendedor/sucursal', 'Productos más y menos vendidos', 'Comparativas mensuales'],
      },
      {
        key: 'security',
        name: 'Auditoría & Trazabilidad',
        short: 'Auditoría',
        icon: ShieldCheck,
        color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        summary: 'Registro detallado de acciones críticas, eliminaciones y cambios de precios.',
        capabilities: ['Registro inmutable con IP y usuario', 'Historial de modificaciones de precios', 'Alertas de actividades sospechosas'],
      },
    ],
  },
]

export function OrganizationDetailView({ data }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const { organization: org, owner, settings, members, subscription, plan_details, branches, counts } = data

  const effectivePlan = (subscription?.plan || org.plan || 'FREE').toUpperCase()
  const effectiveStatus = subscription?.status || 'active'
  const renewalDays = daysUntil(subscription?.current_period_ends_at)

  const verticalMeta = VERTICAL_DESCRIPTIONS[org.business_vertical || 'general'] || VERTICAL_DESCRIPTIONS.general
  const enabledModulesList = org.enabled_modules && org.enabled_modules.length > 0
    ? org.enabled_modules
    : ['pos', 'inventory', 'crm', 'ecommerce']
  
  const totalAvailableModules = MODULE_CATEGORIES.reduce((acc, cat) => acc + cat.modules.length, 0)
  const activeCount = enabledModulesList.length
  const coveragePercent = Math.round((activeCount / totalAvailableModules) * 100)

  const editableOrg: EditableOrganization = {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: effectivePlan,
    subscription_status: effectiveStatus,
    currency: settings?.currency || 'PYG',
    timezone: settings?.timezone || 'America/Asuncion',
    business_vertical: org.business_vertical || 'general',
    operating_model: org.operating_model || 'retail',
    enabled_modules: enabledModulesList,
    trial_ends_at: subscription?.trial_ends_at,
    current_period_ends_at: subscription?.current_period_ends_at,
    cancel_at_period_end: subscription?.cancel_at_period_end,
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado al portapapeles`)
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Return Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <Link href="/superadmin/organizations">
              <ArrowLeft className="h-4 w-4" />
              Volver al Directorio
            </Link>
          </Button>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Expediente: <strong className="text-violet-600 dark:text-violet-400">{org.name}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDialogOpen(true)}
            className="h-8 gap-1.5 rounded-xl text-xs font-bold border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300 cursor-pointer"
          >
            <Wrench className="h-3.5 w-3.5 text-violet-600" />
            Editar Organización & Módulos
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.refresh()}
            className="h-8 w-8 rounded-xl cursor-pointer"
            title="Recargar datos del tenant"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hero Header Card with Core Tenant Info */}
      <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-slate-50 to-blue-50/50 p-6 dark:border-slate-800 dark:from-violet-950/30 dark:via-slate-950/40 dark:to-blue-950/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Avatar & Identity */}
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-3xl bg-violet-600 text-white font-black text-2xl shadow-lg ring-4 ring-white dark:ring-slate-800">
                {org.name.slice(0, 2).toUpperCase()}
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight truncate">
                    {org.name}
                  </h1>
                  <Badge variant="outline" className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full', PLAN_STYLES[effectivePlan] ?? PLAN_STYLES.FREE)}>
                    PLAN {effectivePlan}
                  </Badge>
                  <Badge variant="outline" className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full uppercase', STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES.active)}>
                    {effectiveStatus}
                  </Badge>
                  {subscription?.cancel_at_period_end && (
                    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 font-bold text-[10px]">
                      Cancela al cierre
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${window.location.origin}/${org.slug}/inicio`, 'URL de tienda')}
                    className="inline-flex items-center gap-1 font-mono font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                  >
                    <span>/{org.slug}</span>
                    <Copy className="h-3 w-3 text-slate-400" />
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <Badge variant="outline" className={cn('rounded-lg px-2 py-0 text-[10px] font-extrabold gap-1', verticalMeta.badge)}>
                    <span>{verticalMeta.icon}</span>
                    <span>{verticalMeta.label}</span>
                  </Badge>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span>Moneda: <strong className="text-slate-800 dark:text-slate-200">{settings?.currency || 'PYG'}</strong></span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(org.id, 'UUID de organización')}
                    className="inline-flex items-center gap-1 font-mono text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>ID: {org.id.slice(0, 13)}…</span>
                    <Copy className="h-3 w-3 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <EnterSupportButton organizationId={org.id} organizationName={org.name} />
              
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                <a href={`/${org.slug}/inicio`} target="_blank" rel="noreferrer">
                  <Globe className="h-3.5 w-3.5 text-cyan-600" />
                  Abrir Tienda
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
              </Button>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(org.slug)}`}>
                  <CreditCard className="h-3.5 w-3.5 text-violet-600" />
                  Facturación
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Operational Telemetry Metric Bar */}
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Equipo & Colaboradores</p>
            <p className="text-base font-black text-slate-900 dark:text-slate-100">{members.length} usuarios</p>
            <p className="text-xs text-slate-500 font-medium">Owner: {owner?.full_name || owner?.email || 'Sin asignar'}</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Catálogo & Sucursales</p>
            <p className="text-base font-black text-slate-900 dark:text-slate-100">{counts.products} productos</p>
            <p className="text-xs text-slate-500 font-medium">{branches.length} sucursales registradas</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Capacidad Funcional</p>
            <p className="text-base font-black text-slate-900 dark:text-slate-100">{activeCount} de {totalAvailableModules} módulos</p>
            <p className="text-xs text-slate-500 font-medium">{coveragePercent}% cobertura funcional activa</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Vigencia del Plan</p>
            <p className="text-base font-black text-slate-900 dark:text-slate-100">
              {renewalDays === null ? 'Sin fecha' : renewalDays < 0 ? `${Math.abs(renewalDays)}d vencido` : `${renewalDays}d restantes`}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              Vence: {formatDate(subscription?.current_period_ends_at || subscription?.trial_ends_at)}
            </p>
          </div>
        </div>
      </Card>

      {/* 🤖 Robot Mascot Contextual Consultant */}
      <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-r from-blue-50/60 via-white to-violet-50/60 p-5 dark:border-slate-800 dark:from-blue-950/30 dark:via-slate-900 dark:to-violet-950/30 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <RobotGuide
          variant="navy-gold"
          size="md"
          speechTitle={`Supervisor de Organización: ${org.name}`}
          speechText={`Esta empresa opera en el rubro ${verticalMeta.label} (${org.operating_model === 'wholesale' ? 'Venta Mayorista' : org.operating_model === 'repair' ? 'Taller SAT' : org.operating_model === 'service' ? 'Servicios' : 'Venta Minorista'}). Cuenta con ${activeCount} módulos operativos habilitados y ${members.length} colaboradores registrados.`}
        />
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab('modules')}
            className="h-8 rounded-xl text-xs font-bold bg-white/90 dark:bg-slate-900/90 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 cursor-pointer"
          >
            <Boxes className="h-3.5 w-3.5 mr-1.5 text-violet-600" />
            Ver Matriz de Módulos
          </Button>
          <Button
            size="sm"
            onClick={() => setEditDialogOpen(true)}
            className="h-8 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 cursor-pointer shadow-xs"
          >
            <Wrench className="h-3.5 w-3.5 mr-1.5" />
            Configurar Módulos
          </Button>
        </div>
      </div>

      {/* Tabs Navigation Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95 w-fit">
          <TabsList className="bg-transparent gap-1 p-0 h-auto">
            <TabsTrigger
              value="overview"
              className="gap-2 rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white cursor-pointer"
            >
              <Building2 className="h-3.5 w-3.5" />
              Ficha General
            </TabsTrigger>

            <TabsTrigger
              value="modules"
              className="gap-2 rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white cursor-pointer"
            >
              <Boxes className="h-3.5 w-3.5" />
              Rubro & Módulos ({activeCount})
            </TabsTrigger>

            <TabsTrigger
              value="members"
              className="gap-2 rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white cursor-pointer"
            >
              <Users className="h-3.5 w-3.5" />
              Colaboradores ({members.length})
            </TabsTrigger>

            <TabsTrigger
              value="subscription"
              className="gap-2 rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white cursor-pointer"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Suscripción & Límites
            </TabsTrigger>

            <TabsTrigger
              value="branches"
              className="gap-2 rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white cursor-pointer"
            >
              <Store className="h-3.5 w-3.5" />
              Sucursales ({branches.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6 m-0">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Identity & Legal Card */}
            <Card className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-violet-500" />
                  Identidad del Negocio
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Nombre de la Empresa</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{org.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Subdominio Público</span>
                  <span className="font-mono font-bold text-violet-600 dark:text-violet-400">/{org.slug}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Fecha de Alta / Creación</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(org.created_at)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Última Modificación</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(org.updated_at)}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 font-medium">UUID en Base de Datos</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(org.id, 'UUID')}
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>{org.id}</span>
                    <Copy className="h-3 w-3 text-slate-400" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Owner & Configuration Card */}
            <Card className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-cyan-500" />
                  Propietario & Ajustes Regionales
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Propietario (Owner)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{owner?.full_name || 'Sin nombre registrado'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Email de Contacto</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{owner?.email || 'Sin email'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Moneda Predeterminada</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{settings?.currency || 'PYG'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Zona Horaria</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{settings?.timezone || 'America/Asuncion'}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 font-medium">Nombre de Facturación</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{settings?.display_name || org.name}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Rubro Summary Banner linking to full matrix */}
            <Card className="md:col-span-2 rounded-3xl border border-violet-200/90 bg-gradient-to-br from-violet-50/60 via-white to-cyan-50/40 p-5 shadow-2xs dark:border-violet-900/60 dark:from-violet-950/30 dark:via-slate-900 dark:to-cyan-950/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-2xl shadow-sm border border-slate-200/80 dark:border-slate-700">
                    {verticalMeta.icon}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                        {verticalMeta.label}
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-bold text-slate-500">
                        Modelo {org.operating_model || 'Minorista'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {verticalMeta.desc}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('modules')}
                  className="rounded-xl text-xs font-bold gap-1.5 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/50 cursor-pointer shrink-0"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  Ver los {activeCount} Módulos Activos
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Dedicated Detailed Rubro & Modules Matrix */}
        <TabsContent value="modules" className="space-y-6 m-0">
          
          {/* Header Dossier Card */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95 overflow-hidden">
            <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50/70 via-slate-50 to-cyan-50/50 p-6 dark:border-slate-800 dark:from-violet-950/30 dark:via-slate-950 dark:to-cyan-950/20">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white dark:bg-slate-800 text-3xl shadow-md border border-slate-200/80 dark:border-slate-700">
                    {verticalMeta.icon}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900 dark:text-slate-50">
                        {verticalMeta.label}
                      </h2>
                      <Badge variant="outline" className={cn('rounded-full text-[10px] font-extrabold px-2.5 py-0.5', verticalMeta.badge)}>
                        Rubro Comercial Principal
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[10px] font-bold px-2.5 py-0.5 border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        Modelo: {org.operating_model === 'wholesale' ? 'Mayorista' : org.operating_model === 'repair' ? 'Taller & SAT' : org.operating_model === 'service' ? 'Servicios' : 'Venta Minorista'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                      {verticalMeta.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setEditDialogOpen(true)}
                    size="sm"
                    className="gap-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600 shadow-md cursor-pointer"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Cambiar Rubro o Módulos
                  </Button>
                </div>
              </div>

              {/* Progress Coverage Bar */}
              <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Módulos Operativos Habilitados
                  </span>
                  <span className="font-extrabold text-violet-600 dark:text-violet-400">
                    {activeCount} de {totalAvailableModules} habilitados ({coveragePercent}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${coveragePercent}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Categorized Detailed Module Grid */}
          <div className="space-y-6">
            {MODULE_CATEGORIES.map((category) => {
              const activeInCategory = category.modules.filter((m) => enabledModulesList.includes(m.key)).length

              return (
                <div key={category.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{category.title}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">{category.description}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5">
                      {activeInCategory} de {category.modules.length} activos
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {category.modules.map((mod) => {
                      const isEnabled = enabledModulesList.includes(mod.key)
                      const ModIcon = mod.icon

                      return (
                        <div
                          key={mod.key}
                          className={cn(
                            'rounded-2xl border p-4 transition-all space-y-3 flex flex-col justify-between shadow-2xs',
                            isEnabled
                              ? 'bg-white border-slate-200/90 dark:bg-slate-900/95 dark:border-slate-800 ring-1 ring-emerald-500/20'
                              : 'bg-slate-50/60 border-slate-200/60 dark:bg-slate-950/40 dark:border-slate-800/40 opacity-70'
                          )}
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', mod.color)}>
                                  <ModIcon className="h-4 w-4" />
                                </div>
                                <div>
                                  <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                                    {mod.name}
                                  </h4>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    módulo: {mod.key}
                                  </span>
                                </div>
                              </div>

                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0',
                                  isEnabled
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                )}
                              >
                                {isEnabled ? 'Habilitado' : 'No contratado'}
                              </Badge>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                              {mod.summary}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                              Capacidades Incluidas:
                            </span>
                            <ul className="space-y-0.5">
                              {mod.capabilities.map((cap, idx) => (
                                <li key={idx} className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                  <Check className={cn('h-3 w-3 shrink-0', isEnabled ? 'text-emerald-500' : 'text-slate-400')} />
                                  <span>{cap}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

        </TabsContent>

        {/* Tab 3: Members */}
        <TabsContent value="members" className="space-y-4 m-0">
          <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Colaboradores de la Empresa</CardTitle>
                  <CardDescription className="text-xs">
                    Usuarios con permisos activos dentro del tenant
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-bold">
                  {members.length} usuarios totales
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {members.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400 font-medium">
                  No hay miembros registrados en este tenant.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 font-black text-xs dark:bg-violet-950/50 dark:text-violet-300">
                          {m.profiles?.full_name?.slice(0, 2).toUpperCase() || m.profiles?.email?.slice(0, 2).toUpperCase() || 'US'}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {m.profiles?.full_name || 'Sin nombre'}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {m.profiles?.email || 'Sin email'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-black uppercase px-2 py-0.5',
                            m.role === 'owner' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                          )}
                        >
                          {m.role}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-extrabold uppercase px-2 py-0.5',
                            m.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                          )}
                        >
                          {m.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Subscription */}
        <TabsContent value="subscription" className="space-y-6 m-0">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-amber-500" />
                  Detalle de Suscripción & Facturación
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Nivel de Plan Activo</span>
                  <Badge variant="outline" className={cn('text-xs font-extrabold px-2.5 py-0.5', PLAN_STYLES[effectivePlan])}>
                    PLAN {effectivePlan}
                  </Badge>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Precio Mensual de Lista</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">
                    {formatMoney(plan_details?.price_monthly, plan_details?.currency || 'PYG')} / mes
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Proveedor de Pago</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {subscription?.provider || 'Facturación Manual / Offline'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Inicio del Período</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatDate(subscription?.current_period_starts_at)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Próximo Vencimiento</span>
                  <span className="font-extrabold text-violet-600 dark:text-violet-400">
                    {formatDate(subscription?.current_period_ends_at || subscription?.trial_ends_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 font-medium">Cancelar al cierre del ciclo</span>
                  <span className="font-bold">
                    {subscription?.cancel_at_period_end ? 'Sí (Programada)' : 'No (Renovación continua)'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-500" />
                  Límites Cuantitativos del Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Límite de Colaboradores</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {members.length} / {String(plan_details?.limits?.max_users ?? 'Ilimitado')}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Límite de Sucursales</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {branches.length} / {String(plan_details?.limits?.max_branches ?? 'Ilimitado')}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-slate-400 font-medium">Límite de Productos en Catálogo</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {counts.products} / {String(plan_details?.limits?.max_products ?? 'Ilimitado')}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 font-medium">Soporte Técnico</span>
                  <span className="font-bold text-emerald-600">
                    Prioritario 24/7
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 5: Branches */}
        <TabsContent value="branches" className="space-y-4 m-0">
          <Card className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xs dark:border-slate-800 dark:bg-slate-900/95">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Puntos de Venta & Sucursales</CardTitle>
                  <CardDescription className="text-xs">
                    Locales físicos y centros de distribución registrados
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-bold">
                  {branches.length} sucursales
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {branches.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-400 font-medium">
                  No hay sucursales registradas para esta organización.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {branches.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <Store className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{b.name}</p>
                            {b.is_default && (
                              <Badge variant="outline" className="text-[9px] font-black uppercase bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300">
                                CASA CENTRAL
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {b.address || 'Sin dirección'} · {b.city || 'Paraguay'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {b.phone && (
                          <span className="text-[11px] font-mono text-slate-500">{b.phone}</span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-extrabold uppercase px-2 py-0.5',
                            b.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          )}
                        >
                          {b.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Organization Modal */}
      <EditOrganizationDialog
        organization={editableOrg}
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
