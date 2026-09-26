"use client"

import React, { useMemo, useState } from 'react'
import { AlertCircle, Coins, Eye, History, RefreshCw, ShoppingBag, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { statusConfig } from '@/config/repair-constants'
import type { RepairStatus } from '@/types/repairs'
import {
  useCustomerHistory,
  type CustomerHistoryItem,
  type CustomerHistorySummary,
} from '@/hooks/use-customer-history'

type Tone = 'good' | 'warn' | 'bad' | 'credit' | 'muted'

const TONE_CLASSES: Record<Tone, string> = {
  good: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300',
  warn: 'bg-amber-500/10 text-amber-800 ring-amber-600/25 dark:text-amber-300',
  bad: 'bg-rose-500/10 text-rose-700 ring-rose-600/25 dark:text-rose-300',
  credit: 'bg-violet-500/10 text-violet-700 ring-violet-600/25 dark:text-violet-300',
  muted: 'bg-muted text-muted-foreground ring-border',
}

export function Pill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Qué se le dice a quien atiende sobre el pago de cada operación. */
export function describePayment(item: CustomerHistoryItem): { tone: Tone; label: string; hint?: string } {
  const balance = item.balance ?? 0
  const paidOf = item.paid > 0 ? `Pagó ${formatCurrency(item.paid)} de ${formatCurrency(item.financedTotal ?? item.total)}` : undefined

  switch (item.payment) {
    case 'paid':
      return { tone: 'good', label: 'Pagado' }
    case 'credit_settled':
      return { tone: 'good', label: 'Crédito saldado' }
    case 'partial':
      return item.kind === 'repair' && !item.delivered
        ? { tone: 'warn', label: `Adelanto · resta ${formatCurrency(balance)}`, hint: paidOf }
        : { tone: 'bad', label: `Pago parcial · debe ${formatCurrency(balance)}`, hint: paidOf }
    case 'unpaid':
      return item.kind === 'repair' && !item.delivered
        ? { tone: 'warn', label: `Por cobrar ${formatCurrency(balance)}`, hint: 'Se cobra al retirar' }
        : { tone: 'bad', label: `Debe ${formatCurrency(balance)}`, hint: item.kind === 'repair' ? 'Retirado sin pagar' : undefined }
    case 'credit':
      if (item.balance == null) return { tone: 'credit', label: 'A crédito', hint: 'Cargada a la cuenta corriente' }
      return {
        tone: item.overdue ? 'bad' : 'credit',
        label: item.overdue ? `Cuota vencida · debe ${formatCurrency(balance)}` : `A crédito · debe ${formatCurrency(balance)}`,
        hint: [paidOf, item.nextDueDate ? `Próxima cuota ${formatShortDate(item.nextDueDate)}` : null].filter(Boolean).join(' · ') || undefined,
      }
    case 'no_charge':
      return { tone: 'muted', label: item.delivered ? 'Sin cargo' : 'Sin presupuesto' }
    case 'cancelled':
      return { tone: 'muted', label: item.kind === 'sale' ? 'Anulada' : 'Cancelada' }
  }
}

function stageLabel(item: CustomerHistoryItem) {
  if (item.kind === 'sale') return null
  return statusConfig[item.status as RepairStatus]?.label ?? item.status
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Filter = 'all' | 'sale' | 'repair' | 'balance'

const hasBalance = (item: CustomerHistoryItem) => item.payment !== 'cancelled' && (item.balance ?? 0) > 0

function HistoryRow({
  item,
  onView,
  onCollect,
}: {
  item: CustomerHistoryItem
  onView?: () => void
  onCollect?: () => void
}) {
  const payment = describePayment(item)
  const stage = stageLabel(item)
  const cancelled = item.payment === 'cancelled'
  const Icon = item.kind === 'sale' ? ShoppingBag : Wrench

  return (
    <li className="group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
            item.kind === 'sale'
              ? 'bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-300'
              : 'bg-orange-500/10 text-orange-700 ring-orange-600/20 dark:text-orange-300',
          )}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={cn('truncate text-sm font-semibold text-foreground', cancelled && 'text-muted-foreground')}>
              {item.kind === 'sale' ? 'Venta' : item.title}
            </p>
            <span className="font-mono text-[11px] text-muted-foreground">#{item.reference}</span>
            {stage && <Pill tone={item.delivered ? 'muted' : item.status === 'listo' ? 'good' : 'muted'}>{stage}</Pill>}
          </div>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {item.detail}
          </p>
          <p className="text-[11px] text-muted-foreground/80">{formatShortDate(item.date)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="space-y-1 text-left sm:text-right">
          <p className={cn('font-mono text-sm font-bold tabular-nums text-foreground', cancelled && 'text-muted-foreground line-through')}>
            {formatCurrency(item.total)}
          </p>
          <Pill tone={payment.tone}>{payment.label}</Pill>
          {payment.hint && <p className="text-[11px] text-muted-foreground">{payment.hint}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onView && (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onView}>
              <Eye className="mr-1 h-3.5 w-3.5" />
              Ver
            </Button>
          )}
          {onCollect && hasBalance(item) && (
            <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={onCollect}>
              <Coins className="mr-1 h-3.5 w-3.5" />
              Cobrar
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}

function SummaryStrip({ summary }: { summary: CustomerHistorySummary }) {
  const cells = [
    { label: 'Ventas', value: String(summary.salesCount) },
    { label: 'Reparaciones', value: String(summary.repairsCount), hint: summary.repairsInShop > 0 ? `${summary.repairsInShop} en taller` : undefined },
    { label: 'Deuda', value: formatCurrency(summary.owed), tone: summary.owed > 0 ? 'text-rose-600 dark:text-rose-400' : undefined, hint: summary.overdueCount > 0 ? `${summary.overdueCount} vencida${summary.overdueCount === 1 ? '' : 's'}` : undefined },
    { label: 'Por cobrar al retirar', value: formatCurrency(summary.dueOnPickup), tone: summary.dueOnPickup > 0 ? 'text-amber-700 dark:text-amber-400' : undefined },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-card px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{cell.label}</dt>
          <dd className={cn('mt-0.5 font-mono text-base font-bold tabular-nums text-foreground', cell.tone)}>{cell.value}</dd>
          {cell.hint && <dd className="text-[11px] text-muted-foreground">{cell.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

export function CustomerHistoryList({
  customerId,
  limit,
  onShowAll,
  onViewSale,
  onViewRepair,
  onCollect,
  showSummary = false,
  onlyWithBalance = false,
}: {
  customerId: string
  limit?: number
  onShowAll?: () => void
  onViewSale?: (saleId: string) => void
  onViewRepair?: (repairId: string) => void
  onCollect?: () => void
  showSummary?: boolean
  onlyWithBalance?: boolean
}) {
  const { items, summary, truncated, error, isLoading, refresh } = useCustomerHistory(customerId)
  const [filter, setFilter] = useState<Filter>(onlyWithBalance ? 'balance' : 'all')
  const showFilters = typeof limit !== 'number' && !onlyWithBalance

  const counts = useMemo(() => ({
    all: items.length,
    sale: items.filter((i) => i.kind === 'sale').length,
    repair: items.filter((i) => i.kind === 'repair').length,
    balance: items.filter(hasBalance).length,
  }), [items])

  const filtered = useMemo(() => items.filter((item) => {
    if (filter === 'sale' || filter === 'repair') return item.kind === filter
    if (filter === 'balance') return hasBalance(item)
    return true
  }), [items, filter])

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Cargando historial">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </span>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Reintentar
        </Button>
      </div>
    )
  }

  const visible = typeof limit === 'number' ? filtered.slice(0, limit) : filtered
  const hidden = filtered.length - visible.length

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'Todo' },
    { id: 'sale', label: 'Ventas' },
    { id: 'repair', label: 'Reparaciones' },
    { id: 'balance', label: 'Con saldo' },
  ]

  return (
    <div className="space-y-4">
      {showSummary && summary && <SummaryStrip summary={summary} />}

      {showFilters && items.length > 0 && (
        <div role="tablist" aria-label="Filtrar historial" className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === f.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <History className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">
            {items.length === 0 ? 'Sin ventas ni reparaciones' : filter === 'balance' ? 'No debe nada' : 'Nada en este filtro'}
          </p>
          <p className="text-xs text-muted-foreground">
            {items.length === 0 ? 'Cuando compre o deje un equipo, va a aparecer acá.' : 'Probá con otro filtro.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {visible.map((item) => (
            <HistoryRow
              key={`${item.kind}-${item.id}`}
              item={item}
              onView={
                item.kind === 'sale'
                  ? onViewSale && (() => onViewSale(item.id))
                  : onViewRepair && (() => onViewRepair(item.id))
              }
              onCollect={onCollect}
            />
          ))}
        </ul>
      )}

      {(hidden > 0 && onShowAll) || truncated ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{truncated ? 'Se muestran las 300 operaciones más recientes de cada tipo.' : null}</span>
          {hidden > 0 && onShowAll && (
            <Button variant="ghost" size="sm" onClick={onShowAll}>
              Ver historial completo ({hidden} más)
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
