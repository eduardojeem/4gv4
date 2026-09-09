'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  MoreHorizontal,
  Receipt,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
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
  formatDate,
  formatMoney,
  getRecommendation,
  isAttention,
  periodProgress,
} from './utils'

type Props = {
  items: SuperAdminSubscription[]
  onOpenDetail: (subscription: SuperAdminSubscription) => void
  onCopyValue: (value: string | null) => void
}

export function SubscriptionTable({ items, onOpenDetail, onCopyValue }: Props) {
  return (
    <div className="max-h-[calc(100vh-320px)] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
            <TableHead className="w-[260px] py-2.5 pl-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Organización / Tenant
            </TableHead>
            <TableHead className="w-[120px] py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Plan
            </TableHead>
            <TableHead className="w-[150px] py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Estado
            </TableHead>
            <TableHead className="w-[200px] py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ciclo &amp; Renovación
            </TableHead>
            <TableHead className="w-[140px] py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Actividad
            </TableHead>
            <TableHead className="w-[170px] py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Owner
            </TableHead>
            <TableHead className="w-[170px] py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Diagnóstico
            </TableHead>
            <TableHead className="w-14 py-2.5 pr-6 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Acción
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((sub, idx) => {
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
              <TableRow
                key={sub.id}
                className={cn(
                  'group cursor-pointer border-b border-slate-100/80 transition-colors duration-100',
                  'hover:bg-violet-50/50 dark:border-slate-800/60 dark:hover:bg-violet-950/20',
                  attention
                    ? 'bg-amber-50/30 dark:bg-amber-950/10'
                    : idx % 2 === 0
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-slate-50/60 dark:bg-slate-900/50'
                )}
                tabIndex={0}
                aria-label={`Ver suscripción de ${sub.organization_name}`}
                onClick={() => onOpenDetail(sub)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpenDetail(sub)
                  }
                }}
              >
                {/* 1. Organización / Tenant */}
                <TableCell className="py-3 pl-6">
                  <div className="flex items-center gap-3">
                    {/* Avatar Badge */}
                    <div
                      className={cn(
                        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs shadow-xs ring-1',
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

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-sm text-slate-900 group-hover:text-violet-700 dark:text-slate-100 dark:group-hover:text-violet-300 transition-colors">
                        {sub.organization_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                          {sub.organization_slug ? `/${sub.organization_slug}` : sub.organization_id.slice(0, 8) + '…'}
                        </span>

                        {/* Storefront status pill */}
                        {sub.storefront_public ? (
                          <span
                            title="Tienda pública activa en web"
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60"
                          >
                            <Globe className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                            Pública
                          </span>
                        ) : (
                          <span
                            title="Tienda privada / no publicada"
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          >
                            Privada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* 2. Plan */}
                <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col items-start gap-1">
                    <PlanBadge plan={sub.plan} />
                    {priceFormatted ? (
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {priceFormatted}
                        <span className="text-[10px] font-normal text-slate-400">/mes</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Sin costo</span>
                    )}
                  </div>
                </TableCell>

                {/* 3. Estado — badge + cancel/trial sub-line + provider */}
                <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={sub.status} />

                    {sub.cancel_at_period_end ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        <XCircle className="h-3 w-3 shrink-0" />
                        Cancela al ciclo
                      </span>
                    ) : sub.status === 'trialing' && trialDays !== null ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">
                        <Clock className="h-2.5 w-2.5" />
                        {daysLabel(trialDays, 'trial')}
                      </span>
                    ) : (
                      <span className="text-[10px] capitalize text-slate-400">
                        Vía {sub.provider || 'manual'}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* 4. Ciclo & Renovación */}
                <TableCell className="py-3">
                  <div className="space-y-1.5 pr-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {sub.current_period_ends_at ? formatDate(sub.current_period_ends_at) : 'Sin cierre'}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] font-bold',
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

                    {/* Visual Progress Bar */}
                    <div className="relative w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <Progress
                        value={progress}
                        className={cn(
                          'h-1.5 transition-all',
                          renewalDays !== null && renewalDays < 0
                            ? '[&>div]:bg-rose-500'
                            : renewalDays !== null && renewalDays <= 7
                              ? '[&>div]:bg-amber-500'
                              : '[&>div]:bg-emerald-500'
                        )}
                      />
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {sub.current_period_starts_at ? `Inicio: ${formatDate(sub.current_period_starts_at)}` : 'Sin fecha inicio'}
                    </p>
                  </div>
                </TableCell>

                {/* 5. Actividad */}
                <TableCell className="py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      title="Usuarios / Miembros"
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Users className="h-3 w-3 text-slate-400" />
                      {sub.members_count ?? 0}
                    </span>
                    <span
                      title="Productos en catálogo"
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Boxes className="h-3 w-3 text-slate-400" />
                      {sub.products_count ?? 0}
                    </span>
                    <span
                      title="Ventas realizadas"
                      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Receipt className="h-3 w-3 text-slate-400" />
                      {sub.sales_count ?? 0}
                    </span>
                  </div>
                </TableCell>

                {/* 6. Owner — name + email + Trial badge if trialing */}
                <TableCell className="py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                      {sub.owner_name || 'Sin owner asignado'}
                    </p>
                    <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {sub.owner_email || sub.owner_id || 'Sin email'}
                    </p>
                    {sub.status === 'trialing' && (
                      <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-cyan-50 px-1.5 py-0.5 text-[9px] font-bold text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-800/60">
                        Trial
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* 7. Diagnóstico — colored dot + truncated text, no pill */}
                <TableCell className="py-3">
                  <div className="flex items-start gap-1.5">
                    {attention ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                    ) : (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    )}
                    <span
                      className={cn(
                        'truncate text-xs leading-relaxed',
                        attention
                          ? 'font-semibold text-amber-800 dark:text-amber-200'
                          : 'text-slate-600 dark:text-slate-400'
                      )}
                      title={recommendation}
                    >
                      {recommendation}
                    </span>
                  </div>
                </TableCell>

                {/* 8. Quick Actions */}
                <TableCell className="py-2.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-950/50 dark:hover:text-violet-300 cursor-pointer"
                      onClick={() => onOpenDetail(sub)}
                      title="Ver detalle"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          title="Más opciones"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 shadow-lg rounded-xl">
                        <DropdownMenuItem onClick={() => onOpenDetail(sub)} className="font-semibold cursor-pointer">
                          <UserCheck className="mr-2 h-4 w-4 text-violet-600" />
                          Ver ficha &amp; Gestionar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onCopyValue(sub.id)} className="cursor-pointer">
                          <Copy className="mr-2 h-3.5 w-3.5 text-slate-400" />
                          Copiar Subscription ID
                        </DropdownMenuItem>
                        {(sub.provider_subscription_id || sub.provider_customer_id) && (
                          <DropdownMenuItem
                            onClick={() =>
                              onCopyValue(sub.provider_subscription_id || sub.provider_customer_id)
                            }
                            className="cursor-pointer"
                          >
                            <Copy className="mr-2 h-3.5 w-3.5 text-slate-400" />
                            Copiar ID externo ({sub.provider})
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {sub.organization_slug && (
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={`/${sub.organization_slug}/inicio`} target="_blank">
                              <Globe className="mr-2 h-3.5 w-3.5 text-emerald-600" />
                              Abrir tienda pública
                              <ExternalLink className="ml-auto h-3 w-3 text-slate-400" />
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link
                            href={`/superadmin/organizations?query=${encodeURIComponent(sub.organization_name)}`}
                          >
                            <Users className="mr-2 h-3.5 w-3.5 text-indigo-500" />
                            Ver en Organizaciones
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href="/superadmin/plans">
                            <Boxes className="mr-2 h-3.5 w-3.5 text-amber-500" />
                            Gestionar planes SaaS
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}

          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="h-40 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                  <Boxes className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold">No hay suscripciones que coincidan con los filtros seleccionados.</p>
                  <p className="text-xs text-slate-400">Intenta limpiar los filtros o buscar con otro término.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
