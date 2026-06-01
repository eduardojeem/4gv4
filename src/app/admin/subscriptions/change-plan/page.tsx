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
import { cn } from '@/lib/utils'
import type { CommercialPlan, OrganizationUsage } from '@/lib/saas/subscription-service'

type PageData = {
  currentPlan: CommercialPlan
  usage: OrganizationUsage
  plans: CommercialPlan[]
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
  onSelect,
  isChanging,
}: {
  plan: CommercialPlan
  isCurrent: boolean
  onSelect: (code: string) => void
  isChanging: boolean
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border bg-card transition-shadow',
        isCurrent ? 'border-primary ring-2 ring-primary/30' : 'hover:shadow-md',
        plan.is_popular && !isCurrent && 'border-violet-300 dark:border-violet-700',
      )}
    >
      {plan.is_popular && !isCurrent && (
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
            disabled={isChanging}
          >
            {isChanging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            {plan.price_monthly === 0 ? 'Cambiar a gratuito' : `Cambiar a ${plan.name}`}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function ChangePlanPage() {
  const router = useRouter()
  const [data, setData] = useState<PageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isChanging, setIsChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ConflictResource[]>([])
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/admin/subscriptions/change-plan')
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.plans) setData(payload)
        else setError('No se pudo cargar los planes.')
      })
      .catch(() => setError('No se pudo cargar los planes.'))
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSelect(planCode: string) {
    setIsChanging(true)
    setError(null)
    setConflicts([])

    const response = await fetch('/api/admin/subscriptions/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planCode }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(payload?.error || 'No se pudo cambiar el plan.')
      if (payload?.conflictingResources) setConflicts(payload.conflictingResources)
      setIsChanging(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/admin/subscriptions'), 1800)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/subscriptions"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link>
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/subscriptions"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Cambiar plan</h1>
          <p className="text-sm text-muted-foreground">
            Plan actual: <span className="font-medium">{data?.currentPlan.name}</span>
          </p>
        </div>
      </div>

      {success && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Plan actualizado correctamente. Redirigiendo...</AlertDescription>
        </Alert>
      )}

      {error && (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          {conflicts.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/60 dark:bg-orange-950/20">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Reducí el uso antes de bajar de plan:
              </p>
              <ul className="mt-2 space-y-1">
                {conflicts.map((c) => (
                  <li key={c.resource} className="text-sm text-orange-700 dark:text-orange-400">
                    {c.resource}: {c.current} en uso, límite del plan destino: {c.limit}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {data?.plans.map((plan) => (
          <PlanCard
            key={plan.code}
            plan={plan}
            isCurrent={plan.code === data.currentPlan.code}
            onSelect={handleSelect}
            isChanging={isChanging}
          />
        ))}
      </div>
    </div>
  )
}
