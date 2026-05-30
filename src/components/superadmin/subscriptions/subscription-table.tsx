'use client'

import Link from 'next/link'
import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SuperAdminSubscription } from './types'
import { PlanBadge, StatusBadge } from './subscription-badges'
import {
  daysUntil,
  daysLabel,
  getRecommendation,
  isAttention,
  periodLabel,
  periodProgress,
} from './utils'

type Props = {
  items: SuperAdminSubscription[]
  onOpenDetail: (subscription: SuperAdminSubscription) => void
  onCopyValue: (value: string | null) => void
}

export function SubscriptionTable({ items, onOpenDetail, onCopyValue }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
            <TableHead className="w-[220px] font-semibold text-slate-600 dark:text-slate-400">
              Organización
            </TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Plan</TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Estado</TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Acción sugerida</TableHead>
            <TableHead className="w-[220px] font-semibold text-slate-600 dark:text-slate-400">
              Periodo
            </TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Trial</TableHead>
            <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Owner</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((sub) => {
            const renewalDays = daysUntil(sub.current_period_ends_at)
            const trialDays = daysUntil(sub.trial_ends_at)
            const attention = isAttention(sub)
            const progress = periodProgress(sub)

            return (
              <TableRow
                key={sub.id}
                className={cn(
                  'cursor-pointer border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/30',
                  attention && 'bg-orange-50/30 dark:bg-orange-950/10'
                )}
                onClick={() => onOpenDetail(sub)}
              >
                {/* Org */}
                <TableCell>
                  <div className="flex items-start gap-2">
                    {attention && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-400" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {sub.organization_name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {sub.organization_slug ? `/${sub.organization_slug}` : sub.organization_id.slice(0, 8) + '…'}
                      </p>
                    </div>
                  </div>
                </TableCell>

                {/* Plan */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <PlanBadge plan={sub.plan} />
                </TableCell>

                {/* Status */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={sub.status} />
                    {sub.cancel_at_period_end && (
                      <span className="flex items-center gap-1 text-[11px] text-rose-500 dark:text-rose-400">
                        <XCircle className="h-3 w-3" />
                        Cancela al cierre
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Recommendation */}
                <TableCell>
                  <p className="max-w-[200px] text-sm text-slate-700 dark:text-slate-300">
                    {getRecommendation(sub)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{sub.provider}</p>
                </TableCell>

                {/* Period */}
                <TableCell>
                  <div className="space-y-1.5">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{periodLabel(sub)}</p>
                    <Progress
                      value={progress}
                      className={cn(
                        'h-1.5',
                        renewalDays !== null && renewalDays < 0
                          ? '[&>div]:bg-rose-500'
                          : renewalDays !== null && renewalDays <= 7
                            ? '[&>div]:bg-orange-500'
                            : '[&>div]:bg-emerald-500'
                      )}
                    />
                    <p className="text-xs text-slate-400">
                      {renewalDays === null
                        ? 'Sin vencimiento'
                        : renewalDays < 0
                          ? `${Math.abs(renewalDays)}d vencido`
                          : renewalDays === 0
                            ? 'Vence hoy'
                            : `${renewalDays}d restantes`}
                    </p>
                  </div>
                </TableCell>

                {/* Trial */}
                <TableCell>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {daysLabel(trialDays, 'trial')}
                  </p>
                </TableCell>

                {/* Owner */}
                <TableCell>
                  <p className="max-w-[160px] truncate text-sm text-slate-700 dark:text-slate-300">
                    {sub.owner_name || 'Sin owner'}
                  </p>
                  <p className="max-w-[160px] truncate text-xs text-slate-400">
                    {sub.owner_email || sub.owner_id || ''}
                  </p>
                </TableCell>

                {/* Actions */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Acciones"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => onOpenDetail(sub)}>
                        Ver detalle y editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCopyValue(sub.id)}>
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Copiar subscription ID
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          onCopyValue(sub.provider_subscription_id || sub.provider_customer_id)
                        }
                      >
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Copiar ID externo
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {sub.organization_slug && (
                        <DropdownMenuItem asChild>
                          <Link href={`/${sub.organization_slug}/inicio`}>
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                            Abrir tienda
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/superadmin/organizations?query=${encodeURIComponent(sub.organization_name)}`}
                        >
                          Ver organización
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/superadmin/plans">Gestionar planes</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}

          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-400">
                No hay suscripciones que coincidan con los filtros.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
