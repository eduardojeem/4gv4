'use client'

import Link from 'next/link'
import { ArrowRight, Banknote, CreditCard, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SUBSCRIPTION_PROVIDER_LABELS } from './subscription-edit'
import type { SuperAdminSubscription } from './types'

export function paymentHistoryHref(sub: SuperAdminSubscription) {
  return `/superadmin/invoices?q=${encodeURIComponent(sub.organization_slug || sub.organization_name)}`
}

/** El proveedor asignado no prueba que exista un cobro ni un débito automático. */
export function SubscriptionPaymentSummary({ subscription: sub, compact = false }: {
  subscription: SuperAdminSubscription
  compact?: boolean
}) {
  const provider = sub.provider || 'manual'
  const label = SUBSCRIPTION_PROVIDER_LABELS[provider] || provider
  const Icon = provider === 'manual' || provider.includes('transfer') ? Banknote : CreditCard
  return (
    <div className={compact ? 'mt-2 space-y-1.5' : 'rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40'}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Gestión del pago</span>
        <Badge title="Proveedor asignado; no acredita un cobro confirmado" variant="outline" className="gap-1.5 border-slate-200 bg-background text-xs font-medium dark:border-slate-700">
          <Icon aria-hidden className="size-3.5" />{label}
        </Badge>
      </div>
      {!compact && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Proveedor asignado. Consultá el historial para comprobar cobros; el estado de la suscripción no confirma un pago.</p>}
      <Link href={paymentHistoryHref(sub)} onClick={event => event.stopPropagation()} className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
        <History aria-hidden className="size-3.5" />Historial de cobros<ArrowRight aria-hidden className="size-3" />
      </Link>
    </div>
  )
}
