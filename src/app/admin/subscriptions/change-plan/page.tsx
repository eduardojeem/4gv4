'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Star,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/saas/subscription-ui'
import {
  PagoparPaymentMethodSelector,
  type SubscriptionPaymentMethod,
} from '@/components/admin/subscriptions/PagoparPaymentMethodSelector'
import { cn } from '@/lib/utils'
import type { CommercialPlan, OrganizationUsage } from '@/lib/saas/subscription-service'

type PageData = {
  currentPlan: CommercialPlan
  usage: OrganizationUsage
  plans: CommercialPlan[]
  stripeEnabled?: boolean
  billingMissingFields?: string[]
  /** Vencimiento del mes ya pagado, si sigue vigente. */
  paidPeriodEndsAt?: string | null
  cancelScheduled?: boolean
}

type ChangeResult = {
  checkoutUrl?: string
  redirectTo?: string
  scheduled?: boolean
  effectiveUntil?: string | null
  error?: string
  correlationId?: string
  conflictingResources?: ConflictResource[]
}

type ConflictResource = { resource: string; current: number; limit: number }

function money(amount: number, currency: string) {
  if (amount === 0) return 'Gratis'
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="h-4 w-4 text-emerald-500 flex-none" />
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/40 flex-none" />
  return <span className="text-xs font-medium text-foreground">{value}</span>
}

function PlanCard({
  plan,
  isCurrent,
  isTarget,
  onSelect,
  isChanging,
  isBusy,
}: {
  plan: CommercialPlan
  isCurrent: boolean
  /** Es el plan que se eligio en la comparativa. */
  isTarget: boolean
  onSelect: (code: string) => void
  isChanging: boolean
  isBusy: boolean
}) {
  return (
    <div
      id={`plan-${plan.code}`}
      className={cn(
        'relative flex flex-col rounded-xl border bg-card transition-shadow',
        isCurrent ? 'border-primary ring-2 ring-primary/30' : 'hover:shadow-md',
        isTarget && !isCurrent && 'border-primary ring-2 ring-primary/40 shadow-md',
        plan.is_popular && !isCurrent && !isTarget && 'border-violet-300 dark:border-violet-700',
      )}
    >
      {isTarget && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1 rounded-full bg-primary text-primary-foreground shadow">
            <Check className="h-3 w-3" />
            El que elegiste
          </Badge>
        </div>
      )}
      {plan.is_popular && !isCurrent && !isTarget && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1 rounded-full bg-violet-600 text-white shadow">
            <Star className="h-3 w-3" />
            Más popular
          </Badge>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="gap-1 rounded-full bg-primary text-primary-foreground shadow">
            <CheckCircle2 className="h-3 w-3" />
            Plan actual
          </Badge>
        </div>
      )}

      <div className="p-5 pt-7">
        <h3 className="text-lg font-bold">{plan.name}</h3>
        {plan.description && (
          <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
        )}

        <div className="mt-4 flex items-end gap-1">
          <span className="text-3xl font-bold">
            {money(plan.price_monthly, plan.currency)}
          </span>
          {plan.price_monthly > 0 && (
            <span className="mb-1 text-sm text-muted-foreground">
              /{plan.price_note || 'mes'}
            </span>
          )}
        </div>

        {plan.highlights.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {plan.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2 text-sm">
                <Check className="h-3.5 w-3.5 flex-none text-emerald-500" />
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>

      {plan.features.length > 0 && (
        <div className="border-t px-5 py-4">
          <ul className="space-y-2.5">
            {plan.features.map((f) => (
              <li key={f.label} className="flex items-center justify-between gap-3 text-sm">
                <span className={cn('text-muted-foreground', f.value === false && 'opacity-50')}>
                  {f.label}
                </span>
                <FeatureValue value={f.value} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto border-t p-5">
        {isCurrent ? (
          <Button variant="outline" className="w-full" disabled>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Plan actual
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={() => onSelect(plan.code)}
            disabled={isBusy}
          >
            {isChanging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            {plan.price_monthly === 0 ? 'Cambiar a gratuito' : `Elegir ${plan.name}`}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Las formas que redirigen a una pasarela piden los datos de facturación. */
const CHECKOUT_METHODS: SubscriptionPaymentMethod[] = ['card', 'qr', 'stripe']

function confirmLabel(target: CommercialPlan, method: SubscriptionPaymentMethod, scheduled: boolean) {
  if (target.price_monthly <= 0) return scheduled ? 'Programar el cambio' : 'Cambiar a gratuito'
  if (method === 'transfer') return 'Generar solicitud de transferencia'
  if (method === 'qr') return 'Pagar con QR'
  if (method === 'stripe') return 'Pagar con Stripe'
  return 'Pagar con tarjeta'
}

function PlanChangeDialog({
  data,
  target,
  onClose,
  onConfirm,
  busy,
  error,
  conflicts,
}: {
  data: PageData
  target: CommercialPlan | null
  onClose: () => void
  onConfirm: (method: SubscriptionPaymentMethod) => void
  busy: boolean
  error: string | null
  conflicts: ConflictResource[]
}) {
  const missing = data.billingMissingFields ?? []
  // La base acepta transferencias para renovar el plan actual o para salir de
  // Gratuito; entre planes pagos el cambio va por tarjeta o QR.
  const transferAllowed = data.currentPlan.price_monthly <= 0
  const [method, setMethod] = useState<SubscriptionPaymentMethod>(
    missing.length > 0 && transferAllowed ? 'transfer' : 'card',
  )

  if (!target) return null

  const current = data.currentPlan
  const isPaidTarget = target.price_monthly > 0
  const difference = target.price_monthly - current.price_monthly
  const paidUntil = data.paidPeriodEndsAt ?? null
  const scheduledDowngrade = !isPaidTarget && Boolean(paidUntil)
  const checkoutBlocked = isPaidTarget && missing.length > 0 && CHECKOUT_METHODS.includes(method)

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambiar a {target.name}</DialogTitle>
          <DialogDescription>Revisá el cambio antes de confirmarlo.</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Plan actual</dt>
            <dd className="font-semibold">{current.name}</dd>
            <dd className="text-xs text-muted-foreground">{money(current.price_monthly, current.currency)}{current.price_monthly > 0 ? '/mes' : ''}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Plan nuevo</dt>
            <dd className="font-semibold">{target.name}</dd>
            <dd className="text-xs text-muted-foreground">{money(target.price_monthly, target.currency)}{isPaidTarget ? '/mes' : ''}</dd>
          </div>
          <div className="col-span-2 border-t pt-3">
            <dt className="text-xs text-muted-foreground">Diferencia por mes</dt>
            <dd className={cn('font-semibold', difference > 0 ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400')}>
              {difference === 0
                ? 'Mismo precio'
                : `${difference > 0 ? '+' : '−'}${money(Math.abs(difference), target.currency)}`}
            </dd>
          </div>
        </dl>

        <p className="text-sm text-muted-foreground">
          {!isPaidTarget
            ? scheduledDowngrade
              ? `Seguís con ${current.name} hasta el ${formatDate(paidUntil)}, que ya está pagado. Ese día pasás a ${target.name}.`
              : `El cambio a ${target.name} es inmediato.`
            : `${target.name} se activa cuando se confirma el pago${method === 'transfer' ? ' (al aprobarse el comprobante)' : ''}.`}
        </p>

        {isPaidTarget && paidUntil && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            Tu plan actual está pago hasta el {formatDate(paidUntil)}. El nuevo período empieza el día que se confirme el pago y los días que quedan de {current.name} no se descuentan.
          </div>
        )}

        {isPaidTarget && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Forma de pago</p>
            <PagoparPaymentMethodSelector
              value={method}
              onChange={setMethod}
              disabled={busy}
              disabledMethods={missing.length > 0 ? CHECKOUT_METHODS : []}
              includeStripe={data.stripeEnabled === true}
              includeTransfer={transferAllowed}
            />
            {missing.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Para pagar con tarjeta o QR completá tus datos de facturación (falta: {missing.join(', ')}).{' '}
                <Link href="/admin/subscriptions#billing-form" className="font-semibold underline underline-offset-2">
                  Completar datos
                </Link>
              </p>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p>{error}</p>
            {conflicts.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs">
                {conflicts.map((c) => (
                  <li key={c.resource}>{c.resource}: {c.current} en uso, el plan nuevo permite {c.limit}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Volver</Button>
          <Button type="button" onClick={() => onConfirm(method)} disabled={busy || checkoutBlocked}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel(target, method, scheduledDowngrade)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ChangePlanPage() {
  const router = useRouter()
  const [data, setData] = useState<PageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingPlanCode, setPendingPlanCode] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ConflictResource[]>([])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // La comparativa manda el plan en la URL. Se resalta y se lleva a la vista,
  // pero no se cambia nada solo: el cobro lo confirma la persona.
  const [targetPlan, setTargetPlan] = useState<string | null>(null)

  useEffect(() => {
    try {
      setTargetPlan(new URLSearchParams(window.location.search).get('plan'))
    } catch {
      setTargetPlan(null)
    }
  }, [])

  useEffect(() => {
    if (!targetPlan || !data) return
    const card = document.getElementById(`plan-${targetPlan}`)
    card?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [targetPlan, data])

  useEffect(() => {
    fetch('/api/admin/subscriptions/change-plan')
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.plans) setData(payload)
        else setLoadError(payload?.error || 'No se pudieron cargar los planes.')
      })
      .catch(() => setLoadError('No se pudieron cargar los planes.'))
      .finally(() => setIsLoading(false))
  }, [])

  function openConfirmation(planCode: string) {
    setError(null)
    setConflicts([])
    setPendingPlanCode(planCode)
  }

  async function confirmChange(method: SubscriptionPaymentMethod) {
    if (!pendingPlanCode) return
    const correlationId = crypto.randomUUID()
    setIsSubmitting(true)
    setError(null)
    setConflicts([])

    try {
      const response = await fetch('/api/admin/subscriptions/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId },
        body: JSON.stringify({ plan: pendingPlanCode, paymentMethod: method }),
      })
      const payload = await response.json().catch(() => null) as ChangeResult | null

      if (!response.ok) {
        setError(payload?.error || `No se pudo cambiar el plan. Código: ${payload?.correlationId || correlationId}`)
        if (payload?.conflictingResources) setConflicts(payload.conflictingResources)
        return
      }

      if (payload?.checkoutUrl) {
        window.location.assign(payload.checkoutUrl)
        return
      }
      if (payload?.redirectTo) {
        router.push(payload.redirectTo)
        return
      }

      setPendingPlanCode(null)
      setSuccessMessage(
        payload?.scheduled
          ? `Listo: el cambio quedó programado para el ${formatDate(payload.effectiveUntil)}. Hasta entonces seguís con tu plan actual.`
          : 'Plan actualizado correctamente. Redirigiendo…',
      )
      setTimeout(() => router.push('/admin/subscriptions'), payload?.scheduled ? 3500 : 1800)
    } catch {
      setError(`No se pudo conectar para cambiar el plan. Código: ${correlationId}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/subscriptions"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link>
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{loadError || 'No se pudieron cargar los planes.'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const pendingPlan = data.plans.find((plan) => plan.code === pendingPlanCode) ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/subscriptions"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Cambiar plan</h1>
          <p className="text-sm text-muted-foreground">
            Plan actual: <span className="font-medium">{data.currentPlan.name}</span>
            {data.paidPeriodEndsAt ? ` · pago hasta el ${formatDate(data.paidPeriodEndsAt)}` : ''}
          </p>
        </div>
      </div>

      {successMessage && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {data.cancelScheduled && (
        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertDescription>
            Ya tenés programado el paso al plan Gratuito al vencimiento. Si elegís un plan pago, se activa al confirmarse el pago.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Elegí un plan para ver el detalle del cambio. Nada se cobra ni se aplica hasta que lo confirmes.
      </p>

      <div
        className={cn(
          'grid gap-6',
          data.plans.length >= 4
            ? 'sm:grid-cols-2 xl:grid-cols-4'
            : data.plans.length === 3
              ? 'sm:grid-cols-2 lg:grid-cols-3'
              : 'sm:grid-cols-2',
        )}
      >
        {data.plans.map((plan) => (
          <PlanCard
            key={plan.code}
            plan={plan}
            isCurrent={plan.code === data.currentPlan.code}
            isTarget={plan.code === targetPlan}
            onSelect={openConfirmation}
            isChanging={isSubmitting && pendingPlanCode === plan.code}
            isBusy={isSubmitting}
          />
        ))}
      </div>

      <PlanChangeDialog
        key={pendingPlanCode ?? 'none'}
        data={data}
        target={pendingPlan}
        onClose={() => setPendingPlanCode(null)}
        onConfirm={confirmChange}
        busy={isSubmitting}
        error={error}
        conflicts={conflicts}
      />
    </div>
  )
}
