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
  Wallet,
  TrendingUp,
  Activity,
  Phone,
  Mail,
  Receipt,
  Clock,
  CircleDashed,
  Navigation,
  Monitor,
  Hammer,
  Banknote,
  HandCoins,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ACTIVITY_LABELS,
  getActivityLevel,
  limitUsage,
  type OrganizationActivity,
} from '@/lib/superadmin/organization-activity'
import {
  SOURCE_LABELS,
  accountAge,
  averageTicket,
  configuredOr,
  countMissingContact,
  resolveOnboardingState,
  resolveOrganizationContact,
  type ResolvedField,
} from '@/lib/superadmin/organization-profile'
import {
  MODULE_STATE_LABELS,
  activeModules,
  moduleUsage,
  planCoverage,
  resolveModuleState,
  unusedActiveModules,
  type ModuleContext,
  type ModuleState,
} from '@/lib/superadmin/organization-modules'
import {
  ORGANIZATION_ROLE_HINTS,
  memberStatusLabel,
  partitionMembers,
  roleLabel,
  sortStaff,
} from '@/lib/organization/member-roles'
import {
  ACTIVITY_KIND_LABELS,
  billingCoverage,
  describeCreditOrigins,
  resolveLastActivity,
  type BillingSummary,
  type CreditSummary,
  type OnlineSummary,
  type RepairSummary,
} from '@/lib/superadmin/organization-volume'
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
    storefront_public?: boolean | null
    marketplace_public?: boolean | null
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
  /**
   * Los limites que el sistema realmente aplica (tabla `plans`), no los de la
   * tabla comercial. `null` cuando el plan no tiene ninguno cargado.
   */
  plan_limits: Record<string, unknown> | null
  plan_limits_source: 'technical' | 'commercial' | 'missing'
  /** `plans.modules`: lo que el plan habilita. `null` si el plan no está en la tabla técnica. */
  plan_modules: string[] | null
  /** Módulos con una prueba vigente. */
  module_trials: string[]
  counts: {
    products: number
    /** Los que ocupan cupo del plan: sin lo archivado por baja de plan. */
    quotaProducts: number
    /** Butacas ocupadas: staff activo, sin clientes de la publica. */
    staffMembers: number
    /** `null` cuando no se pudieron contar. */
    cashRegisters: number | null
    sales: number
    customers: number
    /** `null` cuando el modulo de taller no esta disponible. */
    repairs: number | null
  }
  /** Como le va al negocio, no como esta configurado. */
  activity: OrganizationActivity
  /** El barrido de ventas llego al tope: la facturacion es parcial. */
  activityTruncated: boolean
  /**
   * La consulta de miembros fallo. Sin esto, un error se renderizaba como
   * «0 usuarios», que es una afirmacion sobre la organizacion y no sobre la
   * consulta.
   */
  membersFailed: boolean
  /** `organization_settings.modules.admin_settings` */
  admin_settings: Record<string, unknown> | null
  /** `website_settings` con key `company_info` */
  company_info: Record<string, unknown> | null
  /** `billing_profiles` */
  billing: Record<string, unknown> | null
  /** `organization_settings.modules`, para leer la marca de onboarding. */
  settings_modules: unknown
  /** `null` cuando el modulo de taller no esta disponible. */
  repair_summary: RepairSummary | null
  /** `null` cuando el modulo de tienda online no esta disponible. */
  online_summary: OnlineSummary | null
  /** `null` cuando no se pudo leer la cartera de creditos. */
  credit_summary: CreditSummary | null
  /** `null` cuando no se pudieron leer los pagos del servicio. */
  billing_summary: BillingSummary | null
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

/* --------------------------------------------------------- piezas nuevas */

/** Una cifra con su explicacion al lado. `warn` marca lo que hay que mirar. */
function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  warn,
  muted,
}: {
  label: string
  value: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  warn?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        warn
          ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20'
          : 'border-border bg-card'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={cn('h-4 w-4 shrink-0', warn ? 'text-amber-500' : 'text-muted-foreground/50')} />
      </div>
      <p
        className={cn(
          'mt-1.5 text-lg font-bold leading-tight tracking-tight',
          muted ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {value}
      </p>
      <p className={cn('mt-0.5 text-[11px]', warn ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
        {hint}
      </p>
    </div>
  )
}

/**
 * Uso contra el limite del plan. Sin limite definido se muestra la cifra sola:
 * una barra al 0% se leeria como «no usa nada», que es lo contrario de «no hay
 * tope».
 */
function UsageBar({
  label,
  used,
  total,
  limit,
  hint,
  totalNote,
  unavailable,
}: {
  label: string
  used: number
  total?: number
  limit?: unknown
  hint?: string
  totalNote?: string
  /** El modulo no respondio. Un `0` aca seria un dato inventado. */
  unavailable?: string
}) {
  const percent = limitUsage(used, limit)
  const cerca = percent !== null && percent >= 80

  if (unavailable) {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-none text-muted-foreground">Sin dato</p>
        <p className="text-[11px] text-muted-foreground">{unavailable}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums leading-none text-foreground">
        {used.toLocaleString('es-PY')}
        {percent !== null && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            de {Number(limit).toLocaleString('es-PY')}
          </span>
        )}
      </p>

      {percent !== null ? (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', cerca ? 'bg-amber-500' : 'bg-violet-500')}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className={cn('text-[11px]', cerca ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
            {cerca ? `${percent}% del plan — cerca del tope` : `${percent}% del plan`}
            {total !== undefined && total !== used
              ? ` · ${total.toLocaleString('es-PY')} en total${totalNote ? `, ${totalNote}` : ''}`
              : ''}
          </p>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {[
            total !== undefined && total !== used
              ? `${total.toLocaleString('es-PY')} en total${totalNote ? `, ${totalNote}` : ''}`
              : null,
            hint ?? 'Sin tope en el plan',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </div>
  )
}

/** Una persona de la organizacion, con su rol en castellano. */
function MemberRow({
  member,
  showHint,
}: {
  member: {
    id: string
    role: string
    status: string
    created_at: string | null
    profiles?: { email?: string | null; full_name?: string | null } | null
  }
  showHint?: boolean
}) {
  const nombre = member.profiles?.full_name?.trim()
  const correo = member.profiles?.email?.trim()
  const iniciales = (nombre || correo || '??').slice(0, 2).toUpperCase()
  const hint = showHint ? ORGANIZATION_ROLE_HINTS[String(member.role ?? '').toLowerCase()] : undefined
  const estado = String(member.status ?? '').toLowerCase()

  return (
    <div className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-black text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
          {iniciales}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-foreground">
            {nombre || (correo ? correo : 'Sin perfil cargado')}
          </p>
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {nombre && correo ? correo : !correo ? 'Sin correo registrado' : ''}
          </p>
          {hint && <p className="mt-0.5 text-[10px] text-muted-foreground/80">{hint}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            'px-2 py-0.5 text-[10px] font-black uppercase',
            member.role === 'owner' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
          )}
        >
          {roleLabel(member.role)}
        </Badge>
        {estado !== 'active' && (
          <Badge
            variant="outline"
            className={cn(
              'px-2 py-0.5 text-[10px] font-extrabold uppercase',
              estado === 'suspended'
                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
                : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
            )}
          >
            {memberStatusLabel(member.status)}
          </Badge>
        )}
      </div>
    </div>
  )
}

/**
 * Un canal de actividad: cuanto movio y en que estado esta. Un solo numero de
 * ventas no dejaba ver si la empresa vende por mostrador, por la web, o repara.
 */
function StreamCard({
  icon: Icon,
  tone,
  label,
  headline,
  sub,
  rows,
  notes,
  disabled,
  disabledNote,
}: {
  icon: React.ElementType
  tone: string
  label: string
  headline: string
  sub?: string
  rows?: Array<{ label: string; value: string; warn?: boolean }>
  /** Aclaraciones al pie. Varias, porque mas de una puede ser cierta a la vez. */
  notes?: Array<string | false | undefined>
  disabled?: boolean
  disabledNote?: string
}) {
  return (
    <div className={cn('rounded-xl border border-border p-4', disabled && 'opacity-70')}>
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>

      {disabled ? (
        <p className="mt-3 text-xs font-medium text-muted-foreground">{disabledNote}</p>
      ) : (
        <>
          <p className="mt-3 text-lg font-bold tabular-nums leading-none text-foreground">{headline}</p>
          {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}

          {rows && rows.length > 0 && (
            <dl className="mt-3 space-y-1 border-t border-border/60 pt-2">
              {rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-2">
                  <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
                  <dd
                    className={cn(
                      'text-[11px] font-bold tabular-nums',
                      row.warn ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {notes?.filter(Boolean).map((nota) => (
            <p key={nota as string} className="mt-2 text-[10px] leading-snug text-muted-foreground">
              {nota}
            </p>
          ))}
        </>
      )}
    </div>
  )
}

/**
 * Un dato de la ficha, con su procedencia y —cuando existe— la accion que se
 * puede hacer con el. Un telefono que no se puede marcar y una direccion que no
 * abre el mapa son texto, no informacion util.
 */
function DataRow({
  icon: Icon,
  label,
  field,
  href,
  actionLabel,
  fallback = 'Sin cargar',
  mono,
  onCopy,
}: {
  icon: React.ElementType
  label: string
  field: ResolvedField | { value: string | null; source?: null }
  href?: string | null
  actionLabel?: string
  fallback?: string
  mono?: boolean
  onCopy?: () => void
}) {
  const source = 'source' in field ? field.source : null
  const vacio = !field.value

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <div className="flex min-w-0 items-start gap-2">
        <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', vacio ? 'text-muted-foreground/50' : 'text-violet-500')} />
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          {vacio ? (
            <p className="text-xs font-medium text-muted-foreground/70">{fallback}</p>
          ) : (
            <p className={cn('break-words text-xs font-bold text-foreground', mono && 'font-mono text-[11px]')}>
              {field.value}
            </p>
          )}
          {source && (
            <p className="text-[10px] text-muted-foreground/70">{SOURCE_LABELS[source]}</p>
          )}
        </div>
      </div>

      {!vacio && (href || onCopy) && (
        <div className="flex shrink-0 items-center gap-1">
          {href && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-6 rounded-lg px-2 text-[10px] font-bold text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/40"
            >
              <a
                href={href}
                {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
              >
                {actionLabel ?? 'Abrir'}
              </a>
            </Button>
          )}
          {onCopy && (
            <button
              type="button"
              onClick={onCopy}
              aria-label={`Copiar ${label}`}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Una fila «etiqueta / valor» que dice cuando el valor no existe. */
function LimitLikeRow({
  label,
  value,
  fallback = 'Sin dato',
  warn,
}: {
  label: string
  value?: string | null
  fallback?: string
  warn?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-right font-bold',
          !value && 'font-medium text-muted-foreground/70',
          warn && 'text-amber-600 dark:text-amber-400'
        )}
      >
        {value || fallback}
      </span>
    </div>
  )
}

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  trialing: 'En prueba',
  past_due: 'Pago vencido',
  paused: 'Pausada',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
  expired: 'Expirada',
  sin_registro: 'Sin suscripción',
}

const SUBSCRIPTION_STATUS_STYLES: Record<string, string> = {
  active: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  trialing: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  past_due: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  paused: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  canceled: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  expired: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  sin_registro: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
}

/**
 * Una fila «usado / tope». El tope ausente se decia «Ilimitado», que es una
 * afirmacion: el plan puede no tener ningun limite cargado, y entonces el
 * sistema aplica los del plan Free sin que la pantalla lo diga.
 */
function LimitRow({ label, used, limit }: { label: string; used: number | null; limit: unknown }) {
  const max = typeof limit === 'number' ? limit : Number(limit)
  const tiene = Number.isFinite(max) && max > 0
  const definido = limit !== null && limit !== undefined

  return (
    <div className="flex justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
      <span className="font-medium text-slate-400">{label}</span>
      <span className="font-bold tabular-nums text-slate-800 dark:text-slate-200">
        {used === null ? '—' : used.toLocaleString('es-PY')}
        {' / '}
        <span className={cn(!tiene && 'font-medium text-slate-400')}>
          {tiene ? max.toLocaleString('es-PY') : definido ? 'Sin tope' : 'No definido'}
        </span>
      </span>
    </div>
  )
}

const MODULE_STATE_STYLES: Record<ModuleState, string> = {
  on: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  trial: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  off_by_org: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  not_in_plan: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  on_outside_plan: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
}

/** Clientes de la web que se listan antes de resumir: la lista puede tener
 *  cientos y el superadmin viene a mirar al equipo. */
const MAX_CUSTOMERS_VISIBLE = 25

export function OrganizationDetailView({ data }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const { organization: org, owner, settings, members, subscription, plan_details, plan_limits, plan_limits_source, plan_modules, module_trials, branches, counts, activity, activityTruncated, membersFailed, admin_settings, company_info, billing, settings_modules, repair_summary, online_summary, credit_summary, billing_summary } = data
  // Sin fila en `plans` el sistema aplica los limites del plan Free. Decir
  // «Sin tope» ahi seria falso.
  const sinTope =
    plan_limits_source === 'missing'
      ? 'El plan no tiene límites cargados (se aplican los de Free)'
      : 'Sin tope en el plan'

  const defaultBranch = branches.find((b) => b.is_default) ?? branches[0] ?? null
  const contact = resolveOrganizationContact({
    adminSettings: admin_settings,
    companyInfo: company_info,
    defaultBranch: defaultBranch as unknown as Record<string, unknown> | null,
    billing,
    owner: owner as unknown as Record<string, unknown> | null,
  })
  const contactoFaltante = countMissingContact(contact)
  const ticket = averageTicket(activity.revenueTotal, activity.completedSales)
  const antiguedad = accountAge(org.created_at)
  const onboarding = resolveOnboardingState(settings_modules)
  const monedaConfig = configuredOr(settings?.currency, 'PYG')
  const zonaConfig = configuredOr(settings?.timezone, 'America/Asuncion')

  // Un credito de taller o una linea manual no generan una venta en el
  // mostrador: sin esto, «capital prestado» al lado de «facturado» parece una
  // contradiccion.
  const creditosSinVenta = Boolean(
    credit_summary &&
      Object.entries(credit_summary.byOrigin).some(([origen, cantidad]) => origen !== 'sale' && cantidad > 0)
  )

  // `organization_members` guarda al tecnico y al cliente de la web en la misma
  // tabla. Listarlos juntos bajo «Colaboradores» hacia parecer que la empresa
  // tiene 40 empleados cuando tiene 3.
  const equipo = partitionMembers(members)
  const staffOrdenado = sortStaff(equipo.staff)

  const coberturaPagos = billingCoverage(
    plan_details?.price_monthly,
    billing_summary?.paidTotal ?? 0,
    antiguedad?.days ?? null
  )

  // «Actividad» miraba solo la ultima venta del mostrador: una organizacion
  // que financio una reparacion hace dos dias figuraba como «Bajo el ritmo»
  // porque su ultima venta era de hace un mes.
  const ultimoMovimiento = resolveLastActivity({
    sale: activity.lastSaleAt,
    order: online_summary?.lastOrderAt,
    repair: repair_summary?.lastRepairAt,
    credit: credit_summary?.lastCreditAt,
  })
  const activityLevel = getActivityLevel(ultimoMovimiento.days)
  const currency = settings?.currency || 'PYG'
  const storefrontPublic = org.storefront_public === true

  const effectivePlan = (subscription?.plan || org.plan || 'FREE').toUpperCase()
  // `subscription?.status || 'active'` afirmaba «suscripcion activa» sobre una
  // organizacion que no tiene fila en `subscriptions`: no hay nada activo, hay
  // una cuenta sin suscripcion registrada.
  const sinSuscripcion = !subscription
  const effectiveStatus = subscription?.status || 'sin_registro'
  const renewalDays = daysUntil(subscription?.current_period_ends_at)

  const verticalMeta = VERTICAL_DESCRIPTIONS[org.business_vertical || 'general'] || VERTICAL_DESCRIPTIONS.general
  // `enabled_modules === null` significa «todos los del plan», que es la regla
  // de `resolveEffectiveModules`. El codigo anterior lo reemplazaba por una
  // lista fija de cuatro modulos: no solo era inventada, contradecia al
  // sistema, asi que la pantalla mostraba apagados modulos que estaban activos.
  const moduleCtx: ModuleContext = {
    entitled: plan_modules ?? [],
    trials: module_trials ?? [],
    enabled: org.enabled_modules ?? null,
  }
  const allModuleKeys = MODULE_CATEGORIES.flatMap((cat) => cat.modules.map((m) => m.key))
  const enabledModulesList = activeModules(allModuleKeys, moduleCtx)
  const totalAvailableModules = allModuleKeys.length
  const activeCount = enabledModulesList.length
  const cobertura = planCoverage(moduleCtx)

  const usageSignals = {
    sales: activity.completedSales,
    products: counts.products,
    customers: counts.customers,
    orders: online_summary?.total ?? null,
    repairs: repair_summary?.total ?? null,
    credits: credit_summary?.total ?? null,
  }
  const modulosSinUsar = unusedActiveModules(allModuleKeys, moduleCtx, usageSignals)

  // El modulo de creditos puede estar apagado: «nunca financio» y «no lo tiene»
  // son cosas distintas.
  const creditsModuleEnabled = enabledModulesList.includes('credits')

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
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Equipo</p>
            <p className="text-base font-black text-slate-900 dark:text-slate-100">
              {membersFailed
                ? 'Sin dato'
                : `${equipo.staff.length} ${equipo.staff.length === 1 ? 'persona' : 'personas'}`}
            </p>
            <p className="text-xs font-medium text-slate-500">
              {membersFailed
                ? `Owner: ${owner?.full_name || owner?.email || 'Sin asignar'}`
                : equipo.customers.length > 0
                  ? `+ ${equipo.customers.length.toLocaleString('es-PY')} clientes con cuenta web`
                  : `Owner: ${owner?.full_name || owner?.email || 'Sin asignar'}`}
            </p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Catálogo & Sucursales</p>
            <p className="text-base font-black text-slate-900 dark:text-slate-100">{counts.products} productos</p>
            <p className="text-xs text-slate-500 font-medium">{branches.length} sucursales registradas</p>
          </div>

          <div className="p-5 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Capacidad Funcional</p>
            <p className="text-base font-black text-slate-900 dark:text-slate-100">{activeCount} módulos activos</p>
            <p className="text-xs font-medium text-slate-500">
              {cobertura.percent === null
                ? 'El plan no tiene módulos cargados'
                : `${cobertura.active} de ${cobertura.entitled} que da el plan`}
            </p>
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
          speechText={`Esta empresa opera en el rubro ${verticalMeta.label} (${org.operating_model === 'wholesale' ? 'Venta Mayorista' : org.operating_model === 'repair' ? 'Taller SAT' : org.operating_model === 'service' ? 'Servicios' : 'Venta Minorista'}). Cuenta con ${activeCount} módulos operativos habilitados y ${equipo.staff.length} personas en el equipo.`}
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
              Equipo{membersFailed ? '' : ` (${equipo.staff.length})`}
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
          {/* Como le va al negocio.
              El resumen abria con dos tarjetas de metadatos —nombre, slug,
              UUID, zona horaria— que son configuracion. Nada decia cuanto
              factura ni cuando vendio por ultima vez, asi que una empresa que
              dejo de operar hace ocho meses se veia igual que una que vendio
              hoy. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricTile
              label="Facturado"
              value={formatMoney(activity.revenueTotal, currency)}
              hint={
                activityTruncated
                  ? 'Parcial: hay más ventas de las que se pueden sumar de una vez'
                  : `${activity.completedSales.toLocaleString('es-PY')} ventas cobradas`
              }
              warn={activityTruncated}
              icon={Wallet}
            />
            <MetricTile
              label="Últimos 30 días"
              value={formatMoney(activity.revenueLast30, currency)}
              hint={
                activity.revenueTotal > 0
                  ? `${Math.round((activity.revenueLast30 / activity.revenueTotal) * 100)}% de lo histórico`
                  : 'Sin facturación'
              }
              icon={TrendingUp}
            />
            <MetricTile
              label="Ticket promedio"
              value={ticket === null ? 'Sin dato' : formatMoney(ticket, currency)}
              hint={
                ticket === null
                  ? 'Todavía no cobró ninguna venta'
                  : `Sobre ${activity.completedSales.toLocaleString('es-PY')} ventas cobradas`
              }
              muted={ticket === null}
              icon={Receipt}
            />
            <MetricTile
              label="Actividad"
              value={ACTIVITY_LABELS[activityLevel]}
              hint={
                ultimoMovimiento.kind === null
                  ? 'Sin ningún movimiento registrado'
                  : `${ACTIVITY_KIND_LABELS[ultimoMovimiento.kind]} ${
                      ultimoMovimiento.days === 0
                        ? 'hoy'
                        : ultimoMovimiento.days === 1
                          ? 'ayer'
                          : `hace ${ultimoMovimiento.days} días`
                    }`
              }
              warn={activityLevel === 'dormant' || activityLevel === 'never'}
              icon={Activity}
            />
            <MetricTile
              label="Tienda pública"
              value={storefrontPublic ? 'Publicada' : 'Sin publicar'}
              hint={
                storefrontPublic
                  ? `Visible en /${org.slug}`
                  : 'Nadie puede verla todavía'
              }
              muted={!storefrontPublic}
              icon={Globe}
            />
            <MetricTile
              label="Antigüedad"
              value={antiguedad?.label ?? 'Sin fecha de alta'}
              hint={
                onboarding.completed
                  ? `Configuración terminada${onboarding.completedAt ? ` el ${formatDate(onboarding.completedAt)}` : ''}`
                  : 'Nunca terminó de configurar la cuenta'
              }
              warn={!onboarding.completed}
              icon={Clock}
            />
          </div>

          {/* De donde sale la actividad. La pantalla mostraba un unico numero
              de ventas: no habia forma de saber si la empresa vende por
              mostrador, por la tienda online, o repara equipos. */}
          <Card className="rounded-2xl border border-border bg-card">
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                De dónde viene la actividad
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              <StreamCard
                icon={ShoppingCart}
                tone="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"
                label="Punto de venta"
                headline={`${activity.completedSales.toLocaleString('es-PY')} ventas`}
                sub={formatMoney(activity.revenueTotal, currency)}
                rows={[
                  ...(activity.totalSales !== activity.completedSales
                    ? [{
                        label: 'Anuladas',
                        value: (activity.totalSales - activity.completedSales).toLocaleString('es-PY'),
                        warn: true,
                      }]
                    : []),
                  {
                    label: 'Última venta',
                    value: activity.lastSaleAt ? formatDate(activity.lastSaleAt) : 'Nunca',
                  },
                ]}
              />

              <StreamCard
                icon={Monitor}
                tone="bg-cyan-100 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300"
                label="Tienda online"
                disabled={online_summary === null || online_summary.total === 0}
                disabledNote={
                  online_summary === null
                    ? 'No se pudo leer el módulo de pedidos'
                    : 'Todavía no recibió ningún pedido por la web'
                }
                headline={`${(online_summary?.paid ?? 0).toLocaleString('es-PY')} pedidos pagados`}
                sub={formatMoney(online_summary?.revenue ?? 0, currency)}
                rows={[
                  { label: 'Pedidos totales', value: (online_summary?.total ?? 0).toLocaleString('es-PY') },
                  ...(online_summary && online_summary.open > 0
                    ? [{ label: 'En curso', value: online_summary.open.toLocaleString('es-PY'), warn: true }]
                    : []),
                  ...(online_summary && online_summary.partial > 0
                    ? [{ label: 'Cobro parcial', value: online_summary.partial.toLocaleString('es-PY'), warn: true }]
                    : []),
                ]}
                notes={[
                  online_summary && online_summary.partial > 0 &&
                    'Los pedidos con cobro parcial no suman al facturado: no cobraron su total.',
                ]}
              />

              <StreamCard
                icon={Hammer}
                tone="bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300"
                label="Taller"
                disabled={repair_summary === null || repair_summary.total === 0}
                disabledNote={
                  repair_summary === null
                    ? 'El módulo de taller no está disponible'
                    : 'Nunca registró una reparación'
                }
                headline={`${(repair_summary?.total ?? 0).toLocaleString('es-PY')} reparaciones`}
                sub={
                  repair_summary
                    ? `${repair_summary.completed.toLocaleString('es-PY')} terminadas · ${repair_summary.open.toLocaleString('es-PY')} en el taller`
                    : undefined
                }
                rows={[
                  {
                    label: 'Cobrado',
                    value: formatMoney(repair_summary?.collected ?? 0, currency),
                  },
                  ...(repair_summary && repair_summary.pendingBalance > 0
                    ? [{
                        label: 'Terminado sin cobrar',
                        value: formatMoney(repair_summary.pendingBalance, currency),
                        warn: true,
                      }]
                    : []),
                  ...(repair_summary && repair_summary.cancelled > 0
                    ? [{ label: 'Canceladas', value: repair_summary.cancelled.toLocaleString('es-PY') }]
                    : []),
                ]}
                notes={['Lo cobrado por mostrador ya está contado en Punto de venta: no se suma.']}
              />

              <StreamCard
                icon={HandCoins}
                tone="bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300"
                label="Créditos y cuotas"
                disabled={credit_summary === null || credit_summary.total === 0}
                disabledNote={
                  credit_summary === null
                    ? 'No se pudo leer la cartera de créditos'
                    : creditsModuleEnabled
                      ? 'Tiene el módulo habilitado pero nunca financió una venta'
                      : 'No usa financiación: el módulo no está habilitado en su plan'
                }
                headline={`${(credit_summary?.total ?? 0).toLocaleString('es-PY')} créditos`}
                sub={
                  credit_summary
                    ? `${credit_summary.active.toLocaleString('es-PY')} vigentes · ${credit_summary.completed.toLocaleString('es-PY')} saldados`
                    : undefined
                }
                rows={[
                  { label: 'Capital prestado', value: formatMoney(credit_summary?.principal ?? 0, currency) },
                  {
                    label: 'Falta cobrar',
                    value: formatMoney(credit_summary?.outstanding ?? 0, currency),
                    warn: (credit_summary?.outstanding ?? 0) > 0,
                  },
                  ...(credit_summary && credit_summary.overdueInstallments > 0
                    ? [{
                        label: `${credit_summary.overdueInstallments} cuotas vencidas`,
                        value: formatMoney(credit_summary.overdueAmount, currency),
                        warn: true,
                      }]
                    : []),
                  ...(credit_summary && credit_summary.defaulted > 0
                    ? [{ label: 'Incobrables', value: credit_summary.defaulted.toLocaleString('es-PY'), warn: true }]
                    : []),
                  ...(credit_summary && describeCreditOrigins(credit_summary.byOrigin)
                    ? [{ label: 'Origen', value: describeCreditOrigins(credit_summary.byOrigin)! }]
                    : []),
                  ...(credit_summary?.averageTerm
                    ? [{ label: 'Plazo promedio', value: `${credit_summary.averageTerm} meses` }]
                    : []),
                ]}
                notes={[
                  credit_summary?.installmentsTruncated &&
                    'Parcial: no se pudieron leer todas las cuotas, el saldo puede ser mayor.',
                  creditosSinVenta &&
                    'Parte de la cartera no nació de una venta (taller, manual o migrado): por eso el capital prestado puede superar lo facturado en el mostrador.',
                  credit_summary && credit_summary.overdueInstallments > 0 &&
                    'Se cuenta vencida toda cuota impaga cuyo vencimiento ya pasó, esté marcada o no.',
                ]}
              />

              <StreamCard
                icon={Users}
                tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                label="Clientes"
                headline={`${counts.customers.toLocaleString('es-PY')} registrados`}
                sub={
                  counts.customers > 0 && activity.completedSales > 0
                    ? `${(activity.completedSales / counts.customers).toFixed(1)} ventas por cliente`
                    : undefined
                }
                rows={[
                  {
                    label: 'Sucursales',
                    value: `${branches.filter((b) => b.is_active).length} de ${branches.length}`,
                  },
                ]}
              />
            </CardContent>
          </Card>

          {/* Lo que la organizacion pago por el servicio. `subscription_payments`
              existe desde junio y no llegaba a ninguna pantalla: un plan pago
              sin un solo cobro registrado era invisible. */}
          <Card className="rounded-2xl border border-border bg-card">
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Banknote className="h-4 w-4 text-emerald-500" />
                Lo que pagó por el servicio
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total cobrado</p>
                <p className="text-xl font-bold tabular-nums leading-none text-foreground">
                  {billing_summary === null
                    ? 'Sin dato'
                    : formatMoney(billing_summary.paidTotal, billing_summary.currency ?? currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {billing_summary === null
                    ? 'No se pudieron leer los pagos'
                    : billing_summary.paidCount === 0
                      ? 'Nunca registró un pago'
                      : `${billing_summary.paidCount} ${billing_summary.paidCount === 1 ? 'pago' : 'pagos'} cobrados`}
                </p>
                {billing_summary?.mixedCurrency && (
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Hay pagos en más de una moneda: el total suma importes distintos.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Último pago</p>
                <p className="text-xl font-bold tabular-nums leading-none text-foreground">
                  {billing_summary?.lastPaidAmount != null
                    ? formatMoney(billing_summary.lastPaidAmount, billing_summary.currency ?? currency)
                    : 'Sin pagos'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {billing_summary?.lastPaidAt
                    ? `${formatDate(billing_summary.lastPaidAt)}${billing_summary.lastPaidMethod ? ` · ${billing_summary.lastPaidMethod}` : ''}`
                    : 'Ninguno registrado'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Plan actual</p>
                <p className="text-xl font-bold leading-none text-foreground">{effectivePlan}</p>
                <p className="text-[11px] text-muted-foreground">
                  {plan_details?.price_monthly
                    ? `${formatMoney(plan_details.price_monthly, plan_details.currency || currency)} por mes`
                    : 'Sin precio cargado en el plan'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cobertura</p>
                <p
                  className={cn(
                    'text-xl font-bold tabular-nums leading-none',
                    coberturaPagos.behind ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                  )}
                >
                  {coberturaPagos.paidMonths === null
                    ? '—'
                    : `${coberturaPagos.paidMonths} de ${coberturaPagos.expectedMonths} meses`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {coberturaPagos.paidMonths === null
                    ? 'El plan no tiene precio mensual: no hay contra qué comparar'
                    : coberturaPagos.behind
                      ? 'Pagó menos meses de los que lleva la cuenta abierta'
                      : 'Al día con los meses transcurridos'}
                </p>
              </div>

              {billing_summary && (billing_summary.pendingCount > 0 || billing_summary.failedCount > 0 || billing_summary.refundedCount > 0) && (
                <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
                  {billing_summary.pendingCount > 0 && (
                    <Badge variant="outline" className="border-amber-300 text-[10px] font-bold text-amber-700 dark:border-amber-800 dark:text-amber-400">
                      {billing_summary.pendingCount} pendiente{billing_summary.pendingCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                  {billing_summary.failedCount > 0 && (
                    <Badge variant="outline" className="border-rose-300 text-[10px] font-bold text-rose-700 dark:border-rose-900 dark:text-rose-400">
                      {billing_summary.failedCount} fallido{billing_summary.failedCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                  {billing_summary.refundedCount > 0 && (
                    <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">
                      {billing_summary.refundedCount} devuelto{billing_summary.refundedCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lo que la organizacion tiene cargado, contra lo que su plan
              permite. El uso vivia escondido en otra pestaña. */}
          <Card className="rounded-2xl border border-border bg-card">
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Boxes className="h-4 w-4 text-violet-500" />
                Qué tiene cargado
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <UsageBar
                label="Productos"
                used={counts.quotaProducts}
                total={counts.products}
                limit={plan_limits?.products}
                totalNote="incluye archivados por baja de plan"
                hint={sinTope}
              />
              <UsageBar
                label="Usuarios"
                used={counts.staffMembers}
                total={membersFailed ? undefined : members.length}
                limit={plan_limits?.users}
                totalNote="incluye clientes y suspendidos"
                hint={sinTope}
              />
              <UsageBar
                label="Sucursales"
                used={branches.length}
                limit={plan_limits?.branches}
                hint={sinTope}
              />
              <UsageBar
                label="Reparaciones"
                used={repair_summary?.total ?? 0}
                limit={plan_limits?.repairs}
                hint={sinTope}
                unavailable={repair_summary === null ? 'No se pudo leer el módulo de taller' : undefined}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Contacto real del negocio. No estaba en ninguna pestana: un
                superadmin que necesitaba llamar al cliente no tenia donde
                mirar, aunque el dato existe en la base. */}
            <Card className="rounded-2xl border border-border bg-card">
              <CardHeader className="border-b border-border py-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <Phone className="h-4 w-4 text-violet-500" />
                    Cómo contactar al negocio
                  </CardTitle>
                  {contactoFaltante > 0 && (
                    <Badge variant="outline" className="gap-1 border-amber-300 text-[10px] font-bold text-amber-700 dark:border-amber-800 dark:text-amber-400">
                      <CircleDashed className="h-3 w-3" />
                      {contactoFaltante} sin cargar
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-5 py-1">
                <DataRow
                  icon={Phone}
                  label="Teléfono"
                  field={contact.phone}
                  href={contact.phone.value ? `tel:${contact.phone.value.replace(/[^+\d]/g, '')}` : null}
                  actionLabel="Llamar"
                  onCopy={contact.phone.value ? () => copyToClipboard(contact.phone.value!, 'Teléfono') : undefined}
                />
                <DataRow
                  icon={Mail}
                  label="Correo del negocio"
                  field={contact.email}
                  href={contact.email.value ? `mailto:${contact.email.value}` : null}
                  actionLabel="Escribir"
                  onCopy={contact.email.value ? () => copyToClipboard(contact.email.value!, 'Correo') : undefined}
                />
                <DataRow
                  icon={MapPin}
                  label="Dirección"
                  field={contact.address}
                  href={
                    contact.mapsUrl.value
                      ?? (contact.address.value
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            [contact.address.value, contact.city.value].filter(Boolean).join(', ')
                          )}`
                        : null)
                  }
                  actionLabel="Ver mapa"
                />
                <DataRow icon={Navigation} label="Ciudad" field={contact.city} />
                <DataRow
                  icon={UserRound}
                  label="Propietario de la cuenta"
                  field={{ value: owner?.full_name || owner?.email || null, source: null }}
                  href={owner?.email ? `mailto:${owner.email}` : null}
                  actionLabel="Escribir"
                  fallback="Sin propietario asignado"
                />
              </CardContent>
            </Card>

            {/* Identidad fiscal: lo que hace falta para facturarle. Vive en
                `billing_profiles` y nunca llegaba a la pantalla. */}
            <Card className="rounded-2xl border border-border bg-card">
              <CardHeader className="border-b border-border py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <Receipt className="h-4 w-4 text-cyan-500" />
                  Datos para facturarle
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-1">
                <DataRow
                  icon={Building2}
                  label="Razón social"
                  field={contact.legalName}
                  fallback={`Sin cargar — se usaría «${org.name}»`}
                />
                <DataRow
                  icon={Receipt}
                  label="RUC"
                  field={contact.ruc}
                  mono
                  fallback="Sin RUC cargado"
                  onCopy={contact.ruc.value ? () => copyToClipboard(contact.ruc.value!, 'RUC') : undefined}
                />
                <DataRow
                  icon={Mail}
                  label="Correo de facturación"
                  field={contact.billingEmail}
                  href={contact.billingEmail.value ? `mailto:${contact.billingEmail.value}` : null}
                  actionLabel="Escribir"
                />
                <DataRow
                  icon={Coins}
                  label="Moneda"
                  field={{ value: monedaConfig.value, source: null }}
                />
                <DataRow
                  icon={Clock}
                  label="Zona horaria"
                  field={{ value: zonaConfig.value, source: null }}
                />
                {(monedaConfig.isDefault || zonaConfig.isDefault) && (
                  <p className="pb-3 pt-1 text-[10px] text-muted-foreground">
                    {monedaConfig.isDefault && zonaConfig.isDefault
                      ? 'Moneda y zona horaria son los valores por defecto: la organización nunca los eligió.'
                      : monedaConfig.isDefault
                        ? 'La moneda es el valor por defecto: la organización nunca la eligió.'
                        : 'La zona horaria es el valor por defecto: la organización nunca la eligió.'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* La cuenta en si: cuando se dio de alta, donde vive, como se la
                identifica. Reemplaza la tarjeta que repetia el encabezado. */}
            <Card className="rounded-2xl border border-border bg-card md:col-span-2">
              <CardHeader className="border-b border-border py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <Building2 className="h-4 w-4 text-violet-500" />
                  La cuenta
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-x-8 px-5 py-1 md:grid-cols-2">
                <DataRow
                  icon={Calendar}
                  label="Alta"
                  field={{
                    value: `${formatDate(org.created_at)}${antiguedad ? ` · hace ${antiguedad.label}` : ''}`,
                    source: null,
                  }}
                />
                <DataRow
                  icon={RefreshCw}
                  label="Última modificación"
                  field={{ value: formatDate(org.updated_at), source: null }}
                />
                <DataRow
                  icon={CheckCircle2}
                  label="Configuración inicial"
                  field={{
                    value: onboarding.completed
                      ? `Terminada${onboarding.completedAt ? ` el ${formatDate(onboarding.completedAt)}` : ''}`
                      : null,
                    source: null,
                  }}
                  fallback="Nunca la terminó"
                />
                <DataRow
                  icon={Store}
                  label="Sucursal principal"
                  field={{
                    value: defaultBranch ? `${defaultBranch.name}${defaultBranch.city ? ` · ${defaultBranch.city}` : ''}` : null,
                    source: null,
                  }}
                  fallback="Sin sucursal registrada"
                />
                <DataRow
                  icon={Globe}
                  label="Dirección pública"
                  field={{ value: `/${org.slug}`, source: null }}
                  mono
                  href={`/${org.slug}/inicio`}
                  actionLabel="Abrir tienda"
                  onCopy={() => copyToClipboard(`${window.location.origin}/${org.slug}/inicio`, 'URL de tienda')}
                />
                <DataRow
                  icon={Lock}
                  label="Identificador interno"
                  field={{ value: org.id, source: null }}
                  mono
                  onCopy={() => copyToClipboard(org.id, 'UUID')}
                />
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

              {/* Cobertura contra lo que el plan da, no contra el catalogo.
                  Antes se comparaba con los 20 modulos que existen, incluidos
                  los que ese plan nunca va a dar: una cuenta Free al 35% no
                  esta desaprovechando nada, esta en Free. */}
              <div className="mt-5 space-y-2 border-t border-slate-200/70 pt-4 dark:border-slate-800/70">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Uso del plan {effectivePlan}
                  </span>
                  <span className="font-extrabold text-violet-600 dark:text-violet-400">
                    {cobertura.percent === null
                      ? 'El plan no tiene módulos cargados'
                      : `${cobertura.active} de ${cobertura.entitled} módulos que incluye (${cobertura.percent}%)`}
                  </span>
                </div>
                {cobertura.percent !== null && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${cobertura.percent}%` }}
                    />
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  {org.enabled_modules === null
                    ? 'Esta organización no eligió módulos: tiene activos todos los que su plan incluye.'
                    : `Eligió ${activeCount} de los ${totalAvailableModules} módulos del catálogo.`}
                </p>

                {modulosSinUsar.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                    <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                      {modulosSinUsar.length === 1
                        ? 'Hay 1 módulo activo que nunca se usó'
                        : `Hay ${modulosSinUsar.length} módulos activos que nunca se usaron`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                      {modulosSinUsar
                        .map((key) => MODULE_CATEGORIES.flatMap((c) => c.modules).find((m) => m.key === key)?.name ?? key)
                        .join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Categorized Detailed Module Grid */}
          <div className="space-y-6">
            {MODULE_CATEGORIES.map((category) => {
              const activeInCategory = category.modules.filter((m) => enabledModulesList.includes(m.key)).length
              const enPlanCategoria = category.modules.filter(
                (m) => resolveModuleState(m.key, moduleCtx) !== 'not_in_plan'
              ).length

              return (
                <div key={category.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{category.title}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">{category.description}</p>
                    </div>
                    <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-bold">
                      {activeInCategory} activos · {enPlanCategoria} en el plan
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {category.modules.map((mod) => {
                      const estado = resolveModuleState(mod.key, moduleCtx)
                      const isEnabled = estado === 'on' || estado === 'trial' || estado === 'on_outside_plan'
                      const uso = moduleUsage(mod.key, usageSignals)
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
                                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                                    {mod.name}
                                  </h4>
                                  <span className="font-mono text-[10px] text-slate-400">{mod.key}</span>
                                </div>
                              </div>

                              <Badge
                                variant="outline"
                                className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold', MODULE_STATE_STYLES[estado])}
                              >
                                {MODULE_STATE_LABELS[estado]}
                              </Badge>
                            </div>

                            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                              {mod.summary}
                            </p>

                            {isEnabled && uso.label && (
                              <p
                                className={cn(
                                  'text-[11px] font-semibold',
                                  uso.used
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                )}
                              >
                                {uso.used ? uso.label : `${uso.label} — activo pero sin usar`}
                              </p>
                            )}

                            {estado === 'on_outside_plan' && (
                              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                Está activo pero el plan {effectivePlan} no lo incluye: revisar.
                              </p>
                            )}
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

        {/* Tab 3: Members.
            `organization_members` guarda al tecnico y al cliente de la tienda
            publica en la misma tabla. La pestaña los listaba juntos bajo
            «Colaboradores de la Empresa» y mostraba el nombre crudo de la
            columna —`owner`, `seller`, `customer`— como si fuera un rotulo. */}
        <TabsContent value="members" className="space-y-4 m-0">
          {membersFailed ? (
            <Card className="rounded-2xl border border-border bg-card">
              <CardContent className="p-8 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
                No se pudo cargar el equipo. La organización puede tener colaboradores:
                esto es un fallo de la consulta, no una lista vacía.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden rounded-2xl border border-border bg-card">
                <CardHeader className="border-b border-border py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm font-bold">
                        <Users className="h-4 w-4 text-violet-500" />
                        Equipo de trabajo
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Personas que operan el sistema: propietario, administración, caja, ventas y taller
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {equipo.staffActive} {equipo.staffActive === 1 ? 'butaca ocupada' : 'butacas ocupadas'}
                        {plan_limits?.users ? ` de ${Number(plan_limits.users).toLocaleString('es-PY')}` : ''}
                      </Badge>
                      {equipo.staffInvited > 0 && (
                        <Badge variant="outline" className="border-sky-200 text-[10px] font-bold text-sky-700 dark:border-sky-900 dark:text-sky-300">
                          {equipo.staffInvited} sin aceptar
                        </Badge>
                      )}
                      {equipo.staffSuspended > 0 && (
                        <Badge variant="outline" className="border-rose-200 text-[10px] font-bold text-rose-700 dark:border-rose-900 dark:text-rose-300">
                          {equipo.staffSuspended} suspendido{equipo.staffSuspended === 1 ? '' : 's'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {staffOrdenado.length === 0 ? (
                    <p className="p-8 text-center text-xs font-medium text-muted-foreground">
                      Nadie del equipo está registrado todavía: la organización solo tiene clientes.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {staffOrdenado.map((m) => (
                        <MemberRow key={m.id} member={m} showHint />
                      ))}
                    </div>
                  )}

                  {equipo.staffWithoutRole > 0 && (
                    <p className="border-t border-border px-4 py-3 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {equipo.staffWithoutRole} {equipo.staffWithoutRole === 1 ? 'persona no tiene' : 'personas no tienen'} rol
                      cargado. No consumen butaca del plan —el conteo las descarta— pero sí acceden al sistema.
                    </p>
                  )}

                  <p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
                    Solo las personas <strong className="font-semibold text-foreground">activas</strong> ocupan
                    butaca del plan. Las invitadas y las suspendidas no.
                  </p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-2xl border border-border bg-card">
                <CardHeader className="border-b border-border py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm font-bold">
                        <Globe className="h-4 w-4 text-cyan-500" />
                        Clientes de la tienda pública
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Se registraron solos desde la web para comprar. No forman parte del equipo ni consumen butaca del plan.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {equipo.customers.length.toLocaleString('es-PY')} con cuenta
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {equipo.customers.length === 0 ? (
                    <p className="p-8 text-center text-xs font-medium text-muted-foreground">
                      Nadie se registró todavía desde la tienda pública.
                    </p>
                  ) : (
                    <>
                      <div className="divide-y divide-border">
                        {equipo.customers.slice(0, MAX_CUSTOMERS_VISIBLE).map((m) => (
                          <MemberRow key={m.id} member={m} />
                        ))}
                      </div>
                      {equipo.customers.length > MAX_CUSTOMERS_VISIBLE && (
                        <p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
                          Se muestran {MAX_CUSTOMERS_VISIBLE} de {equipo.customers.length.toLocaleString('es-PY')}.
                          La organización tiene {counts.customers.toLocaleString('es-PY')} clientes cargados en total,
                          incluidos los que se dieron de alta por mostrador y no tienen cuenta web.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Tab 4: Subscription */}
        <TabsContent value="subscription" className="space-y-6 m-0">
          {sinSuscripcion && (
            <Card className="rounded-2xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/30">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    No hay una suscripción registrada
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                    El plan {effectivePlan} sale de <code className="font-mono">organizations.plan</code>, sin
                    fila en <code className="font-mono">subscriptions</code>: no hay período, ni vencimiento, ni
                    proveedor de cobro. La pantalla mostraba «activa» igual.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-2xl border border-border bg-card">
              <CardHeader className="border-b border-border py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <CreditCard className="h-4 w-4 text-amber-500" />
                  La suscripción
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-5 py-1 text-xs">
                <div className="flex items-center justify-between border-b border-border/60 py-2.5">
                  <span className="font-medium text-muted-foreground">Plan</span>
                  <Badge variant="outline" className={cn('px-2.5 py-0.5 text-xs font-extrabold', PLAN_STYLES[effectivePlan])}>
                    {effectivePlan}
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-b border-border/60 py-2.5">
                  <span className="font-medium text-muted-foreground">Estado</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-extrabold uppercase',
                      SUBSCRIPTION_STATUS_STYLES[effectiveStatus] ?? SUBSCRIPTION_STATUS_STYLES.sin_registro
                    )}
                  >
                    {SUBSCRIPTION_STATUS_LABELS[effectiveStatus] ?? effectiveStatus}
                  </Badge>
                </div>

                <LimitLikeRow
                  label="Precio de lista"
                  value={
                    plan_details?.price_monthly
                      ? `${formatMoney(plan_details.price_monthly, plan_details.currency || currency)} / mes`
                      : null
                  }
                  fallback="El plan no tiene precio cargado"
                />
                <LimitLikeRow
                  label="Cobro"
                  value={subscription?.provider}
                  fallback={sinSuscripcion ? 'Sin suscripción' : 'Sin proveedor: se factura por fuera'}
                />
                <LimitLikeRow label="Inicio del período" value={subscription?.current_period_starts_at ? formatDate(subscription.current_period_starts_at) : null} />
                <LimitLikeRow
                  label="Próximo vencimiento"
                  value={
                    subscription?.current_period_ends_at
                      ? `${formatDate(subscription.current_period_ends_at)}${
                          renewalDays === null
                            ? ''
                            : renewalDays < 0
                              ? ` · vencido hace ${Math.abs(renewalDays)} días`
                              : ` · faltan ${renewalDays} días`
                        }`
                      : null
                  }
                  warn={renewalDays !== null && renewalDays < 0}
                />
                <LimitLikeRow
                  label="Prueba gratuita"
                  value={subscription?.trial_ends_at ? `Termina el ${formatDate(subscription.trial_ends_at)}` : null}
                  fallback="Sin prueba en curso"
                />
                <div className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-muted-foreground">Al cierre del ciclo</span>
                  <span className={cn('font-bold', subscription?.cancel_at_period_end && 'text-rose-600 dark:text-rose-400')}>
                    {sinSuscripcion
                      ? '—'
                      : subscription?.cancel_at_period_end
                        ? 'Se cancela'
                        : 'Renueva'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border bg-card">
              <CardHeader className="border-b border-border py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <Banknote className="h-4 w-4 text-emerald-500" />
                  Historial de cobros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-5 py-1 text-xs">
                <LimitLikeRow
                  label="Total cobrado"
                  value={
                    billing_summary
                      ? formatMoney(billing_summary.paidTotal, billing_summary.currency ?? currency)
                      : null
                  }
                  fallback="No se pudieron leer los pagos"
                />
                <LimitLikeRow
                  label="Pagos registrados"
                  value={billing_summary ? `${billing_summary.paidCount} cobrados` : null}
                />
                <LimitLikeRow
                  label="Último pago"
                  value={
                    billing_summary?.lastPaidAt
                      ? `${formatDate(billing_summary.lastPaidAt)}${billing_summary.lastPaidMethod ? ` · ${billing_summary.lastPaidMethod}` : ''}`
                      : null
                  }
                  fallback="Nunca registró un pago"
                  warn={billing_summary?.paidCount === 0}
                />
                <LimitLikeRow
                  label="Meses cubiertos"
                  value={
                    coberturaPagos.paidMonths === null
                      ? null
                      : `${coberturaPagos.paidMonths} de ${coberturaPagos.expectedMonths} desde el alta`
                  }
                  fallback="El plan no tiene precio: no hay contra qué comparar"
                  warn={coberturaPagos.behind}
                />
                {billing_summary && (billing_summary.pendingCount > 0 || billing_summary.failedCount > 0) && (
                  <p className="py-2.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    {[
                      billing_summary.pendingCount > 0 && `${billing_summary.pendingCount} pendiente(s)`,
                      billing_summary.failedCount > 0 && `${billing_summary.failedCount} fallido(s)`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <div className="py-2.5">
                  <Button asChild variant="outline" size="sm" className="h-7 rounded-lg text-[11px] font-bold">
                    <Link href={`/superadmin/subscriptions?q=${encodeURIComponent(org.slug)}`}>
                      Ver en Facturación
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border border-border bg-card">
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Layers className="h-4 w-4 text-violet-500" />
                Límites del plan y uso actual
              </CardTitle>
              <CardDescription className="text-xs">
                Son los topes que el sistema aplica al crear cada recurso, contra lo que la organización tiene hoy
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-8 px-5 py-1 text-xs md:grid-cols-2">
              <LimitRow label="Colaboradores" used={counts.staffMembers} limit={plan_limits?.users} />
              <LimitRow label="Sucursales" used={branches.length} limit={plan_limits?.branches} />
              <LimitRow label="Cajas" used={counts.cashRegisters} limit={plan_limits?.cashRegisters} />
              <LimitRow label="Productos en catálogo" used={counts.quotaProducts} limit={plan_limits?.products} />
              <LimitRow label="Reparaciones" used={counts.repairs} limit={plan_limits?.repairs} />
              <LimitRow label="Categorías" used={null} limit={plan_limits?.categories} />
            </CardContent>
            <CardContent className="border-t border-border px-5 py-3">
              <p className="text-[11px] text-muted-foreground">
                {plan_limits_source === 'missing'
                  ? 'El plan no tiene límites cargados: el sistema aplica los del plan Free.'
                  : plan_limits_source === 'commercial'
                    ? 'Límites tomados de la ficha comercial: este plan no está en la tabla técnica.'
                    : 'Un guion significa que ese recurso no se cuenta en esta pantalla, no que sea cero.'}
              </p>
            </CardContent>
          </Card>
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
