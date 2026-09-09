'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock,
  ExternalLink,
  Globe,
  Receipt,
  Users,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { SuperAdminSubscription } from './types'
import { PlanBadge, StatusBadge } from './subscription-badges'
import {
  daysUntil,
  daysLabel,
  formatDate,
  formatMoney,
  getRecommendation,
  isAttention,
  periodProgress,
} from './utils'

type Props = {
  subscription: SuperAdminSubscription
  onOpenDetail: (subscription: SuperAdminSubscription) => void
}

export function SubscriptionCard({ subscription: sub, onOpenDetail }: Props) {
  const renewalDays = daysUntil(sub.current_period_ends_at)
  const trialDays = daysUntil(sub.trial_ends_at)
  const attention = isAttention(sub)
  const progress = periodProgress(sub)
  const recommendation = getRecommendation(sub)

  const initials = (sub.organization_name || 'OR')
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const priceFormatted = sub.plan_details?.price_monthly
    ? formatMoney(sub.plan_details.price_monthly, sub.plan_details.currency || 'PYG')
    : null

  return (
    <div
      onClick={() => onOpenDetail(sub)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenDetail(sub)
        }
      }}
      className={cn(
        'group cursor-pointer rounded-2xl border p-4 transition-all duration-200',
        'hover:border-violet-300 hover:shadow-md dark:hover:border-violet-700',
        attention
          ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20 dark:border-amber-900/60 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/10'
          : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900'
      )}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-xs shadow-xs ring-1',
              attention
                ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-amber-300 dark:ring-amber-800'
                : 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white ring-violet-300 dark:ring-violet-800'
            )}
          >
            {initials}
            {attention && (
              <span
                className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900"
                title="Requiere atención"
              />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-bold text-sm text-slate-900 group-hover:text-violet-700 dark:text-slate-100 dark:group-hover:text-violet-300 transition-colors">
              {sub.organization_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                {sub.organization_slug ? `/${sub.organization_slug}` : sub.organization_id.slice(0, 8) + '…'}
              </span>
              {sub.storefront_public ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60">
                  <Globe className="h-2 w-2" />
                  Pública
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Privada
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <PlanBadge plan={sub.plan} />
          <StatusBadge status={sub.status} />
        </div>
      </div>

      {/* Diagnóstico / Acción — just the pill, no section header */}
      <div
        className={cn(
          'mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
          attention
            ? 'bg-amber-100/70 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60'
            : 'bg-slate-50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {attention ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          )}
          <span className="truncate">{recommendation}</span>
        </div>
        {priceFormatted && (
          <span className="shrink-0 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {priceFormatted}
          </span>
        )}
      </div>

      {/* Period Progress Bar */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            {sub.current_period_ends_at ? `Cierre: ${formatDate(sub.current_period_ends_at)}` : 'Sin fecha fin'}
          </span>
          <span
            className={cn(
              'font-bold text-[11px]',
              renewalDays !== null && renewalDays < 0
                ? 'text-rose-600 dark:text-rose-400'
                : renewalDays !== null && renewalDays <= 7
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-500 dark:text-slate-400'
            )}
          >
            {renewalDays === null
              ? 'Perpetuo'
              : renewalDays < 0
                ? `${Math.abs(renewalDays)}d vencido`
                : renewalDays === 0
                  ? 'Vence hoy'
                  : `${renewalDays}d restantes`}
          </span>
        </div>
        <Progress
          value={progress}
          className={cn(
            'h-1.5',
            renewalDays !== null && renewalDays < 0
              ? '[&>div]:bg-rose-500'
              : renewalDays !== null && renewalDays <= 7
                ? '[&>div]:bg-amber-500'
                : '[&>div]:bg-emerald-500'
          )}
        />
      </div>

      {/* Metrics Strip */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span
            title="Miembros"
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Users className="h-3 w-3 text-slate-400" />
            {sub.members_count ?? 0}
          </span>
          <span
            title="Productos"
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Boxes className="h-3 w-3 text-slate-400" />
            {sub.products_count ?? 0}
          </span>
          <span
            title="Ventas"
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Receipt className="h-3 w-3 text-slate-400" />
            {sub.sales_count ?? 0}
          </span>
        </div>

        <span className="truncate max-w-[140px] text-[11px] text-slate-400 dark:text-slate-500">
          {sub.owner_name || sub.owner_email || 'Sin owner'}
        </span>
      </div>

      {/* Card Footer Actions */}
      <div
        className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          {sub.cancel_at_period_end && (
            <Badge
              variant="outline"
              className="h-6 gap-1 border-rose-200 bg-rose-50 text-[10px] text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
            >
              <XCircle className="h-3 w-3" />
              Cancela al cierre
            </Badge>
          )}
          {sub.status === 'trialing' && trialDays !== null && (
            <Badge
              variant="outline"
              className="h-6 gap-1 border-cyan-200 bg-cyan-50 text-[10px] text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300"
            >
              <Clock className="h-3 w-3" />
              {daysLabel(trialDays, 'trial')}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {sub.organization_slug && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
            >
              <Link href={`/${sub.organization_slug}/inicio`} target="_blank">
                <Globe className="mr-1 h-3 w-3 text-emerald-600" />
                Tienda
                <ExternalLink className="ml-1 h-2.5 w-2.5 text-slate-400" />
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 px-2.5 text-[11px] font-bold bg-violet-600 text-white hover:bg-violet-700 shadow-xs cursor-pointer"
            onClick={() => onOpenDetail(sub)}
          >
            Gestionar
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
