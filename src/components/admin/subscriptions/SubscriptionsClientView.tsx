'use client'

import { useEffect, useState, useMemo, type ElementType } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Info,
  KeyRound,
  Layers,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Users,
  Settings2,
  Filter,
  Infinity as InfinityIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BillingProfileForm } from '@/components/admin/subscriptions/BillingProfileForm'
import { PlansComparison, type PlanRow } from '@/components/admin/subscriptions/PlansComparison'
import { PromoCodeRedeemer } from '@/components/admin/subscriptions/PromoCodeRedeemer'
import {
  getPlanLimit,
  SUBSCRIPTION_PAYMENTS_PAGE_SIZE,
  type BillingProfile,
  type OrganizationUsage,
  type PlanRecord,
  type SubscriptionPayment,
} from '@/lib/saas/subscription-service'
import {
  formatDate as date,
  money,
  quotaTone,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  usagePercent,
  TONE_BADGE,
  TONE_DOT,
  TONE_TEXT,
} from '@/lib/saas/subscription-ui'
import { cn } from '@/lib/utils'

export type SubscriptionsClientViewProps = {
  currentPlan: PlanRecord
  usage: OrganizationUsage
  plans: PlanRecord[]
  payments: SubscriptionPayment[]
  promoRedemptions: Array<{ benefit_snapshot?: Record<string, unknown> | null }>
  billingProfile: BillingProfile | null
  subscriptionStatus: string
  canChangePlan: boolean
  canRedeemCodes: boolean
  averageUsage: number
}

function getPaymentModality(
  payment: SubscriptionPayment,
  promoRedemptions?: Array<{ benefit_snapshot?: Record<string, unknown> | null }>
) {
  const method = (payment.payment_method || '').toLowerCase()
  const provider = (payment.provider || '').toLowerCase()
  const ref = (payment.external_reference || '').toLowerCase()

  const isActivation =
    method.includes('activation') ||
    provider.includes('activation') ||
    method.includes('voucher') ||
    provider.includes('voucher')

  const matchingRedemption = isActivation || payment.external_reference
    ? promoRedemptions?.find((r) => r.benefit_snapshot?.code === payment.external_reference)
    : null

  const benefitType = (matchingRedemption?.benefit_snapshot?.benefit_type as string | undefined)?.toLowerCase()

  if (isActivation || benefitType === 'activate_plan' || benefitType === 'extend_trial' || benefitType === 'extend_period') {
    return {
      type: 'activation_code' as const,
      label: 'Código de Activación',
      badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
      icon: KeyRound,
      matchingRedemption,
    }
  }

  if (method.includes('coupon') || method.includes('promo') || provider.includes('coupon') || benefitType?.includes('discount')) {
    return {
      type: 'coupon' as const,
      label: 'Cupón de Descuento',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      icon: Tag,
      matchingRedemption,
    }
  }

  if (
    method.includes('manual') ||
    provider.includes('manual') ||
    method.includes('admin') ||
    provider.includes('admin') ||
    method.includes('transfer') ||
    method.includes('banc') ||
    method.includes('efectivo') ||
    method.includes('cash') ||
    ref.includes('manual') ||
    ref.includes('transfer')
  ) {
    return {
      type: 'manual_admin' as const,
      label: 'Activación Manual / Admin',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      icon: ShieldCheck,
      matchingRedemption: null,
    }
  }

  if (
    method.includes('trial') ||
    provider.includes('trial') ||
    method.includes('courtesy') ||
    provider.includes('courtesy') ||
    method.includes('welcome') ||
    (payment.amount === 0 && !isActivation)
  ) {
    return {
      type: 'trial_courtesy' as const,
      label: 'Prueba / Cortesía',
      badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
      icon: Sparkles,
      matchingRedemption: null,
    }
  }

  if (
    method.includes('migration') ||
    provider.includes('migration') ||
    method.includes('system') ||
    provider.includes('system') ||
    method.includes('legacy')
  ) {
    return {
      type: 'system_migration' as const,
      label: 'Ajuste / Migración',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      icon: Settings2,
      matchingRedemption: null,
    }
  }

  return {
    type: 'normal' as const,
    label: 'Pago Normal (Pasarela)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    icon: CreditCard,
    matchingRedemption: null,
  }
}

function getRedemptionDetailText(benefit: Record<string, unknown> | null | undefined) {
  if (!benefit) return ''
  const type = String(benefit.benefit_type || '')
  const unit = benefit.duration_unit === 'months' ? 'meses' : 'días'
  const durationDays = Number(benefit.duration_days || 0)
  const durationText = durationDays > 0 ? `${durationDays} ${unit}` : ''

  if (type === 'activate_plan') {
    return `Activación de plan ${String(benefit.target_plan || '')} por ${durationText}`
  }
  if (type === 'extend_trial') {
    return `Extensión de prueba por ${durationText}`
  }
  if (type === 'extend_period') {
    return `Extensión de período por ${durationText}`
  }
  if (type === 'discount_percent') {
    return `Descuento de ${Number(benefit.discount_percent || 0)}%`
  }
  if (type === 'discount_fixed') {
    return `Descuento de ${money(Number(benefit.discount_amount || 0), 'PYG')}`
  }
  return 'Beneficio promocional aplicado'
}

function featureValue(plan: PlanRecord, key: string): string {
  if (plan.features && !Array.isArray(plan.features)) {
    const value = (plan.features as Record<string, unknown>)[key]
    if (typeof value === 'boolean') return value ? 'Incluido' : 'No incluido'
    if (typeof value === 'string') return value
  }
  if (Array.isArray(plan.features)) {
    const found = plan.features.find((item) => {
      const f = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const label = String(f?.label || '').toLowerCase()
      if (key === 'marketplace') return label.includes('marketplace') || label.includes('ecommerce')
      if (key === 'analytics') return label.includes('analytics') || label.includes('analítica')
      if (key === 'credits') return label.includes('crédito') || label.includes('cuota')
      return label.includes(key.toLowerCase())
    })
    if (found) {
      if (typeof found.value === 'boolean') return found.value ? 'Incluido' : 'No incluido'
      if (typeof found.value === 'string') return found.value
    }
  }
  return plan.modules?.includes(key) ? 'Incluido' : 'No incluido'
}

type ResourceDef = {
  key: keyof OrganizationUsage
  label: string
  icon: ElementType
  description: string
}

const RESOURCE_DEFINITIONS: ResourceDef[] = [
  {
    key: 'users',
    label: 'Usuarios / Staff',
    icon: Users,
    description: 'Operadores, vendedores y administradores con acceso',
  },
  {
    key: 'branches',
    label: 'Sucursales',
    icon: Building2,
    description: 'Locales comerciales y puntos de venta físicos habilitados',
  },
  {
    key: 'cashRegisters',
    label: 'Cajas Registradoras',
    icon: CreditCard,
    description: 'Puntos de cobro activos para arqueo y facturación',
  },
  {
    key: 'products',
    label: 'Productos en Catálogo',
    icon: Package,
    description: 'Artículos y variantes disponibles para comercialización',
  },
  {
    key: 'categories',
    label: 'Categorías',
    icon: ShoppingBag,
    description: 'Clasificaciones para organización de inventario',
  },
]

function HowItWorksContent() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2">
          <Badge className="h-6 w-6 p-0 flex items-center justify-center rounded-full text-xs font-bold bg-indigo-600 text-white shadow-xs">
            1
          </Badge>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Límites & Cupos</h4>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Cada plan asigna cupos para usuarios, sucursales, cajas y catálogo. Al alcanzar el límite, puedes subir de plan para seguir expandiendo tu negocio sin interrupciones.
        </p>
      </div>

      <div className="space-y-2 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2">
          <Badge className="h-6 w-6 p-0 flex items-center justify-center rounded-full text-xs font-bold bg-indigo-600 text-white shadow-xs">
            2
          </Badge>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pagos & Facturación</h4>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Los pagos con Pagopar o códigos de activación renuevan el ciclo mensual. Las facturas legales se generan de forma automática con tus datos tributarios fiscales.
        </p>
      </div>

      <div className="space-y-2 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2">
          <Badge className="h-6 w-6 p-0 flex items-center justify-center rounded-full text-xs font-bold bg-indigo-600 text-white shadow-xs">
            3
          </Badge>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cambios de Plan</h4>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Puedes ascender de plan en cualquier momento. Para pasar a un plan menor, el uso actual de tu organización debe adecuarse a los límites del nuevo plan.
        </p>
      </div>
    </div>
  )
}

export function SubscriptionsClientView({
  currentPlan,
  usage,
  plans,
  payments,
  promoRedemptions,
  billingProfile,
  subscriptionStatus,
  canChangePlan,
  canRedeemCodes,
  averageUsage,
}: SubscriptionsClientViewProps) {
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash
      if (hash === '#billing-form' || hash === '#billing') {
        setActiveTab('billing')
      } else if (hash === '#payment-history' || hash === '#payments') {
        setActiveTab('payments')
      } else if (hash === '#plans' || hash === '#change-plan') {
        setActiveTab('plans')
      }
    }

    handleHash()
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  const filteredPayments = useMemo(() => {
    if (paymentFilter === 'all') return payments
    return payments.filter((p) => {
      const mod = getPaymentModality(p, promoRedemptions)
      return mod.type === paymentFilter
    })
  }, [payments, paymentFilter, promoRedemptions])

  const modalityCounts = useMemo(() => {
    const modalities = payments.map((p) => getPaymentModality(p, promoRedemptions))
    return {
      all: payments.length,
      normal: modalities.filter((m) => m.type === 'normal').length,
      activation_code: modalities.filter((m) => m.type === 'activation_code').length,
      coupon: modalities.filter((m) => m.type === 'coupon').length,
      manual_admin: modalities.filter((m) => m.type === 'manual_admin').length,
      trial_courtesy: modalities.filter((m) => m.type === 'trial_courtesy').length,
      system_migration: modalities.filter((m) => m.type === 'system_migration').length,
    }
  }, [payments, promoRedemptions])

  const comparisonRows: PlanRow[] = useMemo(() => {
    return plans.map((plan) => {
      const uLimit = getPlanLimit(plan, 'users')
      const bLimit = getPlanLimit(plan, 'branches')
      const cLimit = getPlanLimit(plan, 'cashRegisters')
      const pLimit = getPlanLimit(plan, 'products')

      return {
        code: plan.code,
        name: plan.name,
        priceLabel: money(plan.price_monthly, plan.currency),
        priceMonthly: plan.price_monthly,
        users: uLimit === null ? 'Ilimitado' : String(uLimit),
        branches: bLimit === null ? 'Ilimitado' : String(bLimit),
        cashRegisters: cLimit === null ? 'Ilimitado' : String(cLimit),
        products: pLimit === null ? 'Ilimitado' : String(pLimit),
        marketplace: featureValue(plan, 'marketplace'),
        analytics: featureValue(plan, 'analytics'),
        credits: featureValue(plan, 'credits'),
        isPopular: plan.is_popular,
      }
    })
  }, [plans])

  // Lo que ofrece el plan en soporte. Estaba escrito «24/7» a mano, asi que el
  // plan gratuito prometia lo mismo que el mas caro.
  const supportLevel = useMemo(() => {
    const value = featureValue(currentPlan, 'soporte')
    if (value !== 'No incluido') return value === 'Incluido' ? 'Incluido' : value
    const alternative = featureValue(currentPlan, 'support')
    if (alternative !== 'No incluido') return alternative === 'Incluido' ? 'Incluido' : alternative
    return currentPlan.price_monthly > 0 ? 'Prioritario' : 'Comunidad'
  }, [currentPlan])

  const resourcesAlertCount = useMemo(() => {
    return RESOURCE_DEFINITIONS.filter((def) => {
      const percent = usagePercent(usage[def.key] ?? 0, getPlanLimit(currentPlan, def.key))
      return percent !== null && percent >= 80
    }).length
  }, [currentPlan, usage])

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full space-y-6"
      >
        {/* Navigation Bar / Tabs Header + Help Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-2">
          <TabsList className="bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl h-auto flex flex-wrap sm:inline-flex border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
            <TabsTrigger
              value="overview"
              className="rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm transition-all gap-2"
            >
              <Layers className="h-4 w-4 text-indigo-500" />
              <span>Resumen & Cupos</span>
              <Badge variant="secondary" className="hidden md:inline-flex text-[10px] px-1.5 py-0 h-4 font-mono font-bold rounded-md">
                {averageUsage}%
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="plans"
              className="rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm transition-all gap-2"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Planes Disponibles</span>
              <span className="hidden sm:inline text-[11px] text-muted-foreground font-normal">({plans.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm transition-all gap-2"
            >
              <Receipt className="h-4 w-4 text-emerald-500" />
              <span>Historial de Pagos</span>
              {payments.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold rounded-md">
                  {payments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm transition-all gap-2"
            >
              <Building2 className="h-4 w-4 text-blue-500" />
              <span>Datos Fiscales</span>
            </TabsTrigger>
          </TabsList>

          {/* Action buttons: Reallocated "¿Cómo funciona?" Dialog + Explorar cambio de plan */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-semibold border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 shadow-2xs gap-1.5"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>¿Cómo funciona?</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl rounded-3xl p-6">
                <DialogHeader>
                  <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400 mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60">
                      <Info className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">Centro de Ayuda SaaS</span>
                  </div>
                  <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    ¿Cómo funciona tu suscripción y facturación?
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Conoce cómo se gestionan tus cupos operativos, los ciclos de pago y la flexibilidad para cambiar de plan.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                  <HowItWorksContent />

                  <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-xs text-indigo-900 dark:text-indigo-200">
                      <p className="font-bold">¿Necesitas un plan a medida o asistencia personalizada?</p>
                      <p className="opacity-90 text-[11px] mt-0.5">Nuestro equipo de soporte está disponible para asesorarte sobre límites y facturación.</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setIsHelpOpen(false)}
                      className="shrink-0 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Entendido
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

          </div>
        </div>

        {/* TAB 1: OVERVIEW & USAGE (REDISEÑADA & LIMPIA) */}
        <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
          {/* Cupos del plan */}
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold tracking-tight text-foreground">
                    Cupos de tu plan
                  </h2>
                  {resourcesAlertCount > 0 ? (
                    <Badge variant="outline" className={cn('gap-1 rounded-full border py-0.5 text-[11px] font-bold', TONE_BADGE.warn)}>
                      <AlertTriangle className="h-3 w-3" />
                      {resourcesAlertCount} {resourcesAlertCount === 1 ? 'cupo cerca del límite' : 'cupos cerca del límite'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className={cn('gap-1 rounded-full border py-0.5 text-[11px] font-bold', TONE_BADGE.ok)}>
                      <CheckCircle2 className="h-3 w-3" />
                      Todo con margen
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {RESOURCE_DEFINITIONS.length} recursos que controla tu plan {currentPlan.name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsHelpOpen(true)}
                  className="h-9 gap-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span>Cómo se cuentan</span>
                </Button>
                {canChangePlan && resourcesAlertCount > 0 && (
                  <Button asChild size="sm" className="h-9 rounded-xl px-4 text-xs font-bold">
                    <Link href="/admin/subscriptions/change-plan">Ampliar límites</Link>
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {RESOURCE_DEFINITIONS.map((def) => {
                const Icon = def.icon
                const current = usage[def.key] ?? 0
                const limit = getPlanLimit(currentPlan, def.key)
                const percent = usagePercent(current, limit)
                const isUnlimited = percent === null
                const tone = quotaTone(percent)
                const available = isUnlimited ? null : Math.max(0, (limit ?? 0) - current)

                const statusLabel = isUnlimited
                  ? 'Sin tope'
                  : percent >= 100
                    ? 'Límite alcanzado'
                    : percent >= 80
                      ? 'Cerca del límite'
                      : 'Con margen'

                return (
                  <Card
                    key={def.key}
                    className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card shadow-2xs transition-shadow hover:shadow-md"
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-transform group-hover:scale-105">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-bold text-foreground">
                              {def.label}
                            </CardTitle>
                            <CardDescription className="mt-0.5 line-clamp-1 text-[11px]">
                              {def.description}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold', TONE_BADGE[tone])}
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2">
                      <div className="mt-2 flex items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-black tabular-nums tracking-tight text-foreground">
                            {current}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {isUnlimited ? 'en uso' : `/ ${limit} máx.`}
                          </span>
                        </div>
                        {!isUnlimited && (
                          <span className={cn('rounded-lg bg-muted px-2 py-0.5 text-xs font-bold tabular-nums', TONE_TEXT[tone])}>
                            {percent}%
                          </span>
                        )}
                      </div>

                      {isUnlimited ? (
                        // Sin tope no hay barra que llenar: una barra al 100% se
                        // lee como «no te queda nada», justo lo contrario.
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                          <InfinityIcon className="h-4 w-4 shrink-0" />
                          <span>Tu plan no pone tope a este recurso</span>
                        </div>
                      ) : (
                        <>
                          <div
                            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuenow={percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${def.label}: ${current} de ${limit}`}
                          >
                            <div
                              className={cn('h-full rounded-full transition-all duration-500', TONE_DOT[tone])}
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Te queda</span>
                            <strong className="font-semibold text-foreground">
                              {available} {available === 1 ? 'lugar' : 'lugares'}
                            </strong>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )
              })}

              {/* 6th Card: Modules & Plan Features Bento Card */}
              <Card className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-muted/30 shadow-2xs">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">
                        Módulos Habilitados
                      </CardTitle>
                      <CardDescription className="text-[11px] mt-0.5">
                        Herramientas activas de tu plan
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-2 shadow-2xs">
                      <span className="text-[11px] font-medium text-muted-foreground">Tienda Web</span>
                      {featureValue(currentPlan, 'marketplace') === 'Incluido' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold">No</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-2 shadow-2xs">
                      <span className="text-[11px] font-medium text-muted-foreground">Analytics</span>
                      {featureValue(currentPlan, 'analytics') === 'Incluido' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold">No</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-2 shadow-2xs">
                      <span className="text-[11px] font-medium text-muted-foreground">Créditos</span>
                      {featureValue(currentPlan, 'credits') === 'Incluido' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold">No</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-2 shadow-2xs">
                      <span className="text-[11px] font-medium text-muted-foreground">Soporte</span>
                      <span className="text-[10px] font-bold text-foreground">{supportLevel}</span>
                    </div>
                  </div>

                  {currentPlan.modules && currentPlan.modules.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1">
                      {currentPlan.modules.map((m: string) => (
                        <Badge key={m} variant="secondary" className="text-[10px] font-medium rounded-lg px-2 py-0.5">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 3. PROMO CODE & ACTIVATION VOUCHER SECTION */}
          <div className="pt-1">
            <PromoCodeRedeemer canRedeem={canRedeemCodes} />
          </div>
        </TabsContent>

        {/* TAB 2: PLANS COMPARISON (INCLUYE GUÍA EXPLICATIVA CONTEXTUAL) */}
        <TabsContent value="plans" className="space-y-6 focus-visible:outline-none">
          <PlansComparison
            canChangePlan={canChangePlan}
            currentPlanCode={currentPlan.code}
            plans={comparisonRows}
          />

          {/* REUBICACIÓN CONTEXTUAL DE LA GUÍA DE FACTURACIÓN */}
          <Card className="overflow-hidden rounded-3xl border border-border bg-muted/30 shadow-2xs">
            <CardHeader className="p-5 sm:p-6 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-extrabold text-foreground sm:text-lg">
                    ¿Cómo funciona tu suscripción y facturación?
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Información clave sobre ciclos de facturación, emisión legal y migración de planes
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 pt-0">
              <HowItWorksContent />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PAYMENT & BILLING HISTORY */}
        <TabsContent value="payments" className="space-y-6 focus-visible:outline-none">
          <Card id="payment-history" className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-extrabold text-foreground">
                      Historial de pagos
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      Cobros, canjes de código y activaciones manuales
                    </CardDescription>
                  </div>
                </div>

                {/* Filter Selector Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant={paymentFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentFilter('all')}
                    className="h-7 text-xs rounded-xl px-2.5 font-bold"
                  >
                    Todos ({modalityCounts.all})
                  </Button>
                  {modalityCounts.normal > 0 && (
                    <Button
                      variant={paymentFilter === 'normal' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentFilter('normal')}
                      className="h-7 text-xs rounded-xl px-2.5 font-semibold gap-1"
                    >
                      <CreditCard className="h-3 w-3" />
                      Normales ({modalityCounts.normal})
                    </Button>
                  )}
                  {modalityCounts.activation_code > 0 && (
                    <Button
                      variant={paymentFilter === 'activation_code' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentFilter('activation_code')}
                      className="h-7 text-xs rounded-xl px-2.5 font-semibold gap-1"
                    >
                      <KeyRound className="h-3 w-3" />
                      Activaciones ({modalityCounts.activation_code})
                    </Button>
                  )}
                  {modalityCounts.coupon > 0 && (
                    <Button
                      variant={paymentFilter === 'coupon' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentFilter('coupon')}
                      className="h-7 text-xs rounded-xl px-2.5 font-semibold gap-1"
                    >
                      <Tag className="h-3 w-3" />
                      Cupones ({modalityCounts.coupon})
                    </Button>
                  )}
                  {modalityCounts.manual_admin > 0 && (
                    <Button
                      variant={paymentFilter === 'manual_admin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentFilter('manual_admin')}
                      className="h-7 text-xs rounded-xl px-2.5 font-semibold gap-1"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Manuales ({modalityCounts.manual_admin})
                    </Button>
                  )}
                  {/* Se contaban pero no habia con que filtrarlas. */}
                  {modalityCounts.trial_courtesy > 0 && (
                    <Button
                      variant={paymentFilter === 'trial_courtesy' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentFilter('trial_courtesy')}
                      className="h-7 text-xs rounded-xl px-2.5 font-semibold gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Cortesía ({modalityCounts.trial_courtesy})
                    </Button>
                  )}
                  {modalityCounts.system_migration > 0 && (
                    <Button
                      variant={paymentFilter === 'system_migration' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentFilter('system_migration')}
                      className="h-7 text-xs rounded-xl px-2.5 font-semibold gap-1"
                    >
                      <Settings2 className="h-3 w-3" />
                      Ajustes ({modalityCounts.system_migration})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredPayments.length === 0 ? (
                <div className="p-8 sm:p-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground shadow-2xs">
                    <Layers className="h-6 w-6" />
                  </div>
                  <h4 className="mt-3 text-sm font-extrabold text-foreground">
                    {paymentFilter === 'all' ? 'Alta de Suscripción Actual' : 'Sin resultados para este filtro'}
                  </h4>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                    {paymentFilter === 'all' ? (
                      subscriptionStatus === 'trialing' ? (
                        <>Tu organización está operando con un <strong>Período de Prueba (Trial)</strong> asignado automáticamente al registrarte.</>
                      ) : currentPlan.price_monthly <= 0 ? (
                        <>Tu organización está operando bajo el <strong>Plan Gratuito Estándar</strong> provisto por el sistema.</>
                      ) : (
                        <>Suscripción gestionada mediante asignación directa del sistema.</>
                      )
                    ) : (
                      'No se encontraron registros con la modalidad seleccionada. Prueba seleccionando "Todos".'
                    )}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Plan {currentPlan.name} · Estado: {subscriptionStatusLabel(subscriptionStatus)}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border">
                        <TableHead className="font-bold text-xs">Fecha</TableHead>
                        <TableHead className="font-bold text-xs">Plan</TableHead>
                        <TableHead className="font-bold text-xs">Modalidad</TableHead>
                        <TableHead className="font-bold text-xs">Método / Origen</TableHead>
                        <TableHead className="font-bold text-xs">Monto</TableHead>
                        <TableHead className="font-bold text-xs">Estado</TableHead>
                        <TableHead className="font-bold text-xs">Referencia / Voucher</TableHead>
                        <TableHead className="font-bold text-xs text-right">Comprobante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => {
                        const modality = getPaymentModality(payment, promoRedemptions)
                        const ModalityIcon = modality.icon
                        const matchingRedemption = modality.matchingRedemption

                        return (
                          <TableRow key={payment.id} className="border-border hover:bg-muted/40">
                            <TableCell className="text-xs font-medium text-muted-foreground">
                              {date(payment.paid_at || payment.created_at)}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-foreground">
                              {/* Sin plan guardado va un guion: poner el plan actual
                                  atribuia un cobro viejo al plan de hoy. */}
                              {plans.find((p) => p.code === payment.plan_id)?.name || payment.plan_id || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn('rounded-xl text-[11px] font-bold border gap-1 py-0.5 px-2.5 shadow-2xs', modality.badgeClass)}
                              >
                                <ModalityIcon className="h-3 w-3" />
                                {modality.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-semibold capitalize text-foreground">
                                {payment.payment_method === 'activation_code' || payment.provider === 'activation'
                                  ? 'Canje de Código'
                                  : payment.provider === 'pagopar'
                                    ? 'Pagopar'
                                    : payment.provider === 'mercado_pago'
                                      ? 'Mercado Pago'
                                      : payment.payment_method || payment.provider || 'Manual'}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-bold tabular-nums text-foreground">
                              {money(payment.amount, payment.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('rounded-full border text-[11px] font-semibold', TONE_BADGE[subscriptionStatusTone(payment.status)])}>
                                {subscriptionStatusLabel(payment.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {modality.type === 'activation_code' || modality.type === 'coupon' ? (
                                <div className="space-y-0.5">
                                  <span className={cn(
                                    'font-mono font-bold text-xs px-2 py-0.5 rounded-md border',
                                    modality.type === 'activation_code'
                                      ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
                                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                  )}>
                                    {payment.external_reference || 'Código aplicado'}
                                  </span>
                                  {matchingRedemption && (
                                    <p className="text-[10px] text-muted-foreground leading-tight mt-1 font-medium">
                                      {getRedemptionDetailText(matchingRedemption.benefit_snapshot)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="font-mono text-muted-foreground">
                                  {payment.external_reference || payment.provider_payment_id || '—'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {payment.receipt_url ? (
                                <Button asChild size="sm" variant="outline" className="rounded-xl h-8 text-xs font-semibold">
                                  <a href={payment.receipt_url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                    Ver recibo
                                  </a>
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {payments.length >= SUBSCRIPTION_PAYMENTS_PAGE_SIZE && (
                <p className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
                  Se muestran los últimos {SUBSCRIPTION_PAYMENTS_PAGE_SIZE} movimientos. Si necesitás un comprobante más
                  antiguo, escribinos y te lo enviamos.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: BILLING PROFILE */}
        <TabsContent value="billing" className="space-y-6 focus-visible:outline-none">
          <Card id="billing-form" className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-extrabold text-foreground">
                    Datos para tus facturas
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs">
                    Con estos datos se emiten y timbran las facturas legales de tu suscripción
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <BillingProfileForm profile={billingProfile} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
