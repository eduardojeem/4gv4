'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, Boxes, ExternalLink, Globe, Receipt, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { SuperAdminSubscription } from './types'
import { PlanBadge, StatusBadge } from './subscription-badges'
import { subscriptionPriceLabel } from './subscription-edit'
import { SubscriptionPaymentSummary } from './subscription-payment-summary'
import { daysUntil, formatDate, getAttentionLevel, getRecommendation, periodProgress, subscriptionEndDate } from './utils'

type Props = {
  subscription: SuperAdminSubscription
  onOpenDetail: (subscription: SuperAdminSubscription) => void
}

export function SubscriptionCard({ subscription: sub, onOpenDetail }: Props) {
  const end = subscriptionEndDate(sub)
  const days = daysUntil(end)
  const level = getAttentionLevel(sub)
  const trial = sub.status === 'trialing'
  const start = trial ? sub.created_at : sub.current_period_starts_at
  const hasCycle = Boolean(start && end && new Date(end).getTime() > new Date(start).getTime())
  const progress = periodProgress({ ...sub, current_period_starts_at: start, current_period_ends_at: end })
  const initials = (sub.organization_name || 'OR').trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const price = subscriptionPriceLabel(sub)

  return (
    <article aria-label={`Suscripción de ${sub.organization_name}`} className={cn(
      'flex min-w-0 flex-col rounded-2xl border bg-background p-5 shadow-sm transition-shadow hover:shadow-md',
      level === 'urgent' ? 'border-rose-200 dark:border-rose-900/60' : level === 'watch' ? 'border-amber-200 dark:border-amber-900/60' : 'border-slate-200 dark:border-slate-800'
    )}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{initials}</span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold text-foreground">{sub.organization_name}</h3>
          <p className="mt-1 break-all text-xs text-muted-foreground">{sub.organization_slug ? `/${sub.organization_slug}` : sub.organization_id}</p>
        </div>
        <StatusBadge status={sub.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2"><PlanBadge plan={sub.plan} /><span className="text-xs text-muted-foreground">{sub.plan_details?.name}</span></div>
        <p className="text-sm font-semibold">{price}{Boolean(sub.plan_details?.price_monthly) && <span className="text-xs font-normal text-muted-foreground"> /mes</span>}</p>
      </div>
      <div className={cn('my-4 flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed', level === 'urgent' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200' : level === 'watch' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200' : 'bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300')}>
        {level !== 'none' && <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />}<span>{getRecommendation(sub)}</span>
      </div>
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
          <span className="text-muted-foreground">{trial ? 'Fin de prueba' : 'Fin del período'}: <span>{end ? formatDate(end) : 'Sin fecha definida'}</span></span>
          {days !== null && <span className={cn('font-semibold', days < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-foreground')}>{days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Vence hoy' : `${days}d restantes`}</span>}
        </div>
        {hasCycle && <Progress aria-label={trial ? 'Avance de la prueba' : 'Avance del ciclo'} value={progress} className="h-1.5 [&>div]:bg-violet-500" />}
        {sub.cancel_at_period_end && <Badge variant="outline" className="text-xs">Cancelación al cierre</Badge>}
      </div>
      <SubscriptionPaymentSummary subscription={sub} />
      <div className="my-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        {[{Icon:Users,label:'usuarios',value:sub.members_count},{Icon:Boxes,label:'productos',value:sub.products_count},{Icon:Receipt,label:'ventas',value:sub.sales_count}].map(({Icon,label,value}) => <div key={label} className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 p-2 dark:bg-slate-900"><Icon aria-hidden className="size-3.5"/><span className="font-semibold text-foreground">{value ?? 0}</span><span>{label}</span></div>)}
      </div>
      <p className="mb-4 break-words text-xs text-muted-foreground">Responsable: {sub.owner_name || sub.owner_email || 'Sin responsable'}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">Tienda {sub.storefront_public ? 'pública' : 'privada'}</span>
        <div className="flex items-center gap-2">
          {sub.organization_slug && <Button asChild variant="outline" size="sm" className="min-h-11 gap-1.5 rounded-xl"><Link href={`/${sub.organization_slug}/inicio`} target="_blank" rel="noopener noreferrer"><Globe aria-hidden className="size-3.5"/>Tienda<ExternalLink aria-hidden className="size-3"/></Link></Button>}
          <Button size="sm" className="min-h-11 gap-1.5 rounded-xl" onClick={() => onOpenDetail(sub)}>Gestionar<ArrowRight aria-hidden className="size-3.5"/></Button>
        </div>
      </div>
    </article>
  )
}
