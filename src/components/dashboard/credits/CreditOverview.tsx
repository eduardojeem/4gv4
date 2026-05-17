'use client'

import { useMemo } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { formatCreditId } from '@/lib/utils'
import { CreditRow, InstallmentRow, isInstallmentLate } from '@/hooks/use-credits'

interface CreditOverviewProps {
  credits: CreditRow[]
  installments: InstallmentRow[]
  creditById: Record<string, CreditRow>
  remainingByCredit: Record<string, number>
}

type AgingBucket = {
  key: string
  label: string
  amount: number
  count: number
  tone: string
}

type PriorityItem = {
  id: string
  title: string
  description: string
  tone: 'critical' | 'warning' | 'info' | 'good'
}

const toneClasses: Record<string, { badge: string; bar: string; track: string; value: string }> = {
  emerald: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    track: 'bg-emerald-100 dark:bg-emerald-950/40',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    bar: 'bg-amber-500',
    track: 'bg-amber-100 dark:bg-amber-950/40',
    value: 'text-amber-700 dark:text-amber-300',
  },
  orange: {
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    bar: 'bg-orange-500',
    track: 'bg-orange-100 dark:bg-orange-950/40',
    value: 'text-orange-700 dark:text-orange-300',
  },
  rose: {
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    bar: 'bg-rose-500',
    track: 'bg-rose-100 dark:bg-rose-950/40',
    value: 'text-rose-700 dark:text-rose-300',
  },
  violet: {
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    bar: 'bg-violet-500',
    track: 'bg-violet-100 dark:bg-violet-950/40',
    value: 'text-violet-700 dark:text-violet-300',
  },
  sky: {
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    bar: 'bg-sky-500',
    track: 'bg-sky-100 dark:bg-sky-950/40',
    value: 'text-sky-700 dark:text-sky-300',
  },
}

const priorityToneClasses: Record<PriorityItem['tone'], string> = {
  critical: 'border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100',
  warning: 'border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
  info: 'border-sky-200 bg-sky-50/80 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100',
  good: 'border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100',
}

const getOutstandingAmount = (installment: InstallmentRow) => {
  const amount = Number(installment.amount || 0)
  const paid = Math.max(0, Number(installment.amount_paid || 0))
  return Math.max(0, amount - Math.min(amount, paid))
}

const startOfDay = (value: Date) => {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function CreditOverview({
  credits,
  installments,
  creditById,
  remainingByCredit,
}: CreditOverviewProps) {
  const metrics = useMemo(() => {
    const now = new Date()
    const today = startOfDay(now)
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)

    let totalScheduled = 0
    let totalCollected = 0
    let portfolioCurrent = 0
    let portfolioOverdue = 0
    let dueTodayAmount = 0
    let dueTodayCount = 0
    let dueNext7DaysAmount = 0
    let dueNext7DaysCount = 0
    let partialInstallmentsCount = 0
    let partialInstallmentsAmount = 0
    let totalDaysOverdue = 0
    let overdueInstallmentsCount = 0

    const overdueCustomers = new Set<string>()
    const currentBucket = { amount: 0, count: 0 }
    const bucket1to7 = { amount: 0, count: 0 }
    const bucket8to30 = { amount: 0, count: 0 }
    const bucket31to60 = { amount: 0, count: 0 }
    const bucket60plus = { amount: 0, count: 0 }

    for (const installment of installments) {
      const amount = Number(installment.amount || 0)
      const paid = Math.max(0, Number(installment.amount_paid || 0))
      const outstanding = getOutstandingAmount(installment)
      const dueDate = startOfDay(new Date(installment.due_date))
      const isLate = outstanding > 0 && isInstallmentLate(installment)

      totalScheduled += amount
      totalCollected += Math.min(amount, paid)

      if (outstanding <= 0) {
        continue
      }

      if (paid > 0) {
        partialInstallmentsCount += 1
        partialInstallmentsAmount += outstanding
      }

      if (dueDate.getTime() === today.getTime()) {
        dueTodayCount += 1
        dueTodayAmount += outstanding
      }

      if (dueDate > today && dueDate <= nextWeek) {
        dueNext7DaysCount += 1
        dueNext7DaysAmount += outstanding
      }

      if (isLate) {
        const daysOverdue = Math.max(
          1,
          Math.floor((today.getTime() - dueDate.getTime()) / 86400000)
        )

        portfolioOverdue += outstanding
        overdueInstallmentsCount += 1
        totalDaysOverdue += daysOverdue
        overdueCustomers.add(creditById[installment.credit_id]?.customer_id || installment.credit_id)

        if (daysOverdue <= 7) {
          bucket1to7.amount += outstanding
          bucket1to7.count += 1
        } else if (daysOverdue <= 30) {
          bucket8to30.amount += outstanding
          bucket8to30.count += 1
        } else if (daysOverdue <= 60) {
          bucket31to60.amount += outstanding
          bucket31to60.count += 1
        } else {
          bucket60plus.amount += outstanding
          bucket60plus.count += 1
        }
      } else {
        portfolioCurrent += outstanding
        currentBucket.amount += outstanding
        currentBucket.count += 1
      }
    }

    const activeCreditsCount = credits.filter((credit) => credit.status === 'active').length
    const collectionRate = totalScheduled > 0 ? (totalCollected / totalScheduled) * 100 : 0
    const averageDaysOverdue = overdueInstallmentsCount > 0
      ? Math.round(totalDaysOverdue / overdueInstallmentsCount)
      : 0

    const agingBuckets: AgingBucket[] = [
      { key: 'current', label: 'Al dia', amount: currentBucket.amount, count: currentBucket.count, tone: 'emerald' },
      { key: '1-7', label: '1-7 dias', amount: bucket1to7.amount, count: bucket1to7.count, tone: 'amber' },
      { key: '8-30', label: '8-30 dias', amount: bucket8to30.amount, count: bucket8to30.count, tone: 'orange' },
      { key: '31-60', label: '31-60 dias', amount: bucket31to60.amount, count: bucket31to60.count, tone: 'rose' },
      { key: '60+', label: '60+ dias', amount: bucket60plus.amount, count: bucket60plus.count, tone: 'violet' },
    ]

    const topDebtors = Object.entries(remainingByCredit)
      .map(([creditId, outstanding]) => {
        const openInstallments = installments.filter((installment) =>
          installment.credit_id === creditId && getOutstandingAmount(installment) > 0
        )
        const overdueAmount = openInstallments.reduce((sum, installment) => (
          isInstallmentLate(installment) ? sum + getOutstandingAmount(installment) : sum
        ), 0)
        const nextDueInstallment = [...openInstallments].sort((a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        )[0]
        const daysOverdue = openInstallments.reduce((maxDays, installment) => {
          if (!isInstallmentLate(installment)) return maxDays

          const overdueDays = Math.max(
            1,
            Math.floor((today.getTime() - startOfDay(new Date(installment.due_date)).getTime()) / 86400000)
          )
          return Math.max(maxDays, overdueDays)
        }, 0)

        return {
          creditId,
          customerName: creditById[creditId]?.customer_name || 'Cliente',
          outstanding: Number(outstanding || 0),
          overdueAmount,
          nextDueDate: nextDueInstallment?.due_date,
          daysOverdue,
        }
      })
      .filter((row) => row.outstanding > 0)
      .sort((a, b) => (
        b.overdueAmount - a.overdueAmount ||
        b.outstanding - a.outstanding ||
        b.daysOverdue - a.daysOverdue
      ))
      .slice(0, 5)

    const priorityItems: PriorityItem[] = []

    if (portfolioOverdue > 0) {
      priorityItems.push({
        id: 'overdue-portfolio',
        title: 'Cartera vencida activa',
        description: `${formatCurrency(portfolioOverdue)} repartidos en ${overdueInstallmentsCount} cuota${overdueInstallmentsCount !== 1 ? 's' : ''}.`,
        tone: 'critical',
      })
    }

    if (dueTodayCount > 0) {
      priorityItems.push({
        id: 'due-today',
        title: 'Cobranza para hoy',
        description: `${dueTodayCount} cuota${dueTodayCount !== 1 ? 's' : ''} por ${formatCurrency(dueTodayAmount)} vencen hoy.`,
        tone: 'warning',
      })
    }

    if (partialInstallmentsCount > 0) {
      priorityItems.push({
        id: 'partial-payments',
        title: 'Pagos parciales abiertos',
        description: `${partialInstallmentsCount} cuota${partialInstallmentsCount !== 1 ? 's' : ''} siguen abiertas por ${formatCurrency(partialInstallmentsAmount)}.`,
        tone: 'info',
      })
    }

    if (portfolioOverdue <= 0 && dueTodayCount <= 0) {
      priorityItems.push({
        id: 'healthy-book',
        title: 'Cartera controlada',
        description: 'No hay vencimientos criticos ni alertas inmediatas en la cartera visible.',
        tone: 'good',
      })
    }

    return {
      activeCreditsCount,
      collectionRate,
      totalCollected,
      portfolioCurrent,
      portfolioOverdue,
      overdueCustomersCount: overdueCustomers.size,
      overdueInstallmentsCount,
      dueTodayCount,
      dueTodayAmount,
      dueNext7DaysCount,
      dueNext7DaysAmount,
      partialInstallmentsCount,
      averageDaysOverdue,
      agingBuckets,
      topDebtors,
      priorityItems,
    }
  }, [credits, installments, creditById, remainingByCredit])

  const maxAgingAmount = Math.max(
    1,
    ...metrics.agingBuckets.map((bucket) => bucket.amount)
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: 'Cartera vigente',
            value: formatCurrency(metrics.portfolioCurrent),
            subtitle: `${metrics.dueNext7DaysCount} cuota${metrics.dueNext7DaysCount !== 1 ? 's' : ''} vencen en 7 dias`,
            icon: Wallet,
            tone: 'sky',
          },
          {
            title: 'Cartera vencida',
            value: formatCurrency(metrics.portfolioOverdue),
            subtitle: `${metrics.overdueInstallmentsCount} cuota${metrics.overdueInstallmentsCount !== 1 ? 's' : ''} en atraso`,
            icon: AlertTriangle,
            tone: 'rose',
          },
          {
            title: 'Clientes en mora',
            value: String(metrics.overdueCustomersCount),
            subtitle: `${metrics.activeCreditsCount} creditos activos monitoreados`,
            icon: Users,
            tone: 'amber',
          },
          {
            title: 'Cobertura cobrada',
            value: `${metrics.collectionRate.toFixed(1)}%`,
            subtitle: `${formatCurrency(metrics.totalCollected)} recuperado del plan total`,
            icon: CheckCircle2,
            tone: 'emerald',
          },
        ].map((card) => {
          const Icon = card.icon
          const tone = toneClasses[card.tone]

          return (
            <Card key={card.title} className="border-border/60 bg-white dark:bg-white/[0.02] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {card.title}
                    </p>
                    <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${tone.value}`}>
                      {card.value}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {card.subtitle}
                    </p>
                  </div>
                  <div className={`rounded-2xl p-3 ${tone.track}`}>
                    <Icon className={`h-5 w-5 ${tone.value}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="border-border/60 bg-white dark:bg-white/[0.02] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4.5 w-4.5 text-sky-600" />
              Antiguedad de cartera
            </CardTitle>
            <CardDescription>
              Distribucion del saldo pendiente por tramo de vencimiento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.agingBuckets.map((bucket) => {
              const tone = toneClasses[bucket.tone]
              const width = Math.max(6, Math.round((bucket.amount / maxAgingAmount) * 100))

              return (
                <div key={bucket.key} className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={tone.badge}>
                      {bucket.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {bucket.count} cuota{bucket.count !== 1 ? 's' : ''}
                    </span>
                    <span className={`ml-auto text-sm font-semibold tabular-nums ${tone.value}`}>
                      {formatCurrency(bucket.amount)}
                    </span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${tone.track}`}>
                    <div
                      className={`h-full rounded-full ${tone.bar}`}
                      style={{ width: `${bucket.amount > 0 ? width : 0}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-white dark:bg-white/[0.02] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleAlert className="h-4.5 w-4.5 text-amber-600" />
              Prioridades de cobranza
            </CardTitle>
            <CardDescription>
              Lo mas urgente para intervenir en esta cartera.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.priorityItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border px-4 py-3 ${priorityToneClasses[item.tone]}`}
              >
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs opacity-85">{item.description}</p>
              </div>
            ))}

            <div className="grid gap-3 pt-2 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Vence hoy
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(metrics.dueTodayAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics.dueTodayCount} cuota{metrics.dueTodayCount !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Proximos 7 dias
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(metrics.dueNext7DaysAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics.dueNext7DaysCount} cuota{metrics.dueNext7DaysCount !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Atraso promedio
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {metrics.averageDaysOverdue} dias
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics.partialInstallmentsCount} pagos parciales abiertos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-white dark:bg-white/[0.02] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4.5 w-4.5 text-rose-600" />
            Mayores saldos abiertos
          </CardTitle>
          <CardDescription>
            Creditos con mayor exposicion vencida o saldo pendiente dentro del tablero actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.topDebtors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                No hay deuda abierta para destacar.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40 rounded-xl border border-border/50">
              {metrics.topDebtors.map((debtor) => (
                <div
                  key={debtor.creditId}
                  className="grid gap-3 px-4 py-3 md:grid-cols-[1.3fr_auto_auto_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {debtor.customerName}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {formatCreditId(debtor.creditId)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Saldo abierto
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(debtor.outstanding)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Vencido
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {formatCurrency(debtor.overdueAmount)}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Proximo hito
                    </p>
                    <p className="text-sm font-medium">
                      {debtor.daysOverdue > 0
                        ? `${debtor.daysOverdue} dia${debtor.daysOverdue !== 1 ? 's' : ''} de atraso`
                        : debtor.nextDueDate
                          ? new Date(debtor.nextDueDate).toLocaleDateString('es-PY', {
                              day: '2-digit',
                              month: 'short',
                            })
                          : 'Sin fecha'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
