'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  ShoppingBag,
  WalletCards,
  Wrench,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import type { CustomerAccountSummary } from '@/lib/profile/customer-account-summary'

interface ProfileAccountSummaryProps {
  summary: CustomerAccountSummary
  tenantPrefix?: string
}

export function ProfileAccountSummary({ summary, tenantPrefix = '' }: ProfileAccountSummaryProps) {
  const repairsHref = tenantPrefix ? `${tenantPrefix}/mis-reparaciones` : '/mis-reparaciones'
  const creditsHref = tenantPrefix ? `${tenantPrefix}/perfil/creditos` : '/perfil/creditos'
  const netState = summary.netBalance > 0
    ? { label: 'Saldo neto a favor', amount: summary.netBalance, tone: 'text-emerald-700 dark:text-emerald-300', icon: WalletCards }
    : summary.netBalance < 0
      ? { label: 'Saldo neto por pagar', amount: Math.abs(summary.netBalance), tone: 'text-amber-700 dark:text-amber-300', icon: AlertTriangle }
      : { label: 'Cuenta al día', amount: 0, tone: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 }
  const NetIcon = netState.icon

  const details = [
    {
      label: 'Reparaciones por pagar',
      value: formatCurrency(summary.repairs.pendingAmount),
      detail: `${summary.repairs.pendingCount} pendientes · ${summary.repairs.paidCount} pagadas`,
      icon: Wrench,
      emphasis: summary.repairs.pendingAmount > 0,
    },
    {
      label: 'Cuotas de crédito',
      value: formatCurrency(summary.financing.pendingAmount),
      detail: summary.financing.overdueCount > 0
        ? `${summary.financing.overdueCount} ${summary.financing.overdueCount === 1 ? 'cuota vencida' : 'cuotas vencidas'}`
        : 'Sin cuotas vencidas',
      icon: CreditCard,
      emphasis: summary.financing.overdueCount > 0,
    },
    {
      label: 'Pedidos por pagar',
      value: formatCurrency(summary.orders.pendingAmount),
      detail: `${summary.orders.pendingCount} pendientes · ${summary.orders.paidCount} pagados`,
      icon: ShoppingBag,
      emphasis: summary.orders.pendingAmount > 0,
    },
    {
      label: 'Saldo disponible a favor',
      value: formatCurrency(summary.storeCredit),
      detail: 'Disponible para próximas operaciones',
      icon: CircleDollarSign,
      emphasis: false,
    },
  ]

  return (
    <section aria-labelledby="account-summary-title" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Estado de cuenta</p>
          <h2 id="account-summary-title" className="mt-1 text-lg font-semibold text-foreground">
            Pagos, deudas y saldo disponible
          </h2>
        </div>
        <div className="flex items-center gap-3 rounded-md bg-muted/55 px-4 py-3 sm:min-w-56">
          <NetIcon className={cn('h-5 w-5 shrink-0', netState.tone)} aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">{netState.label}</p>
            <p className={cn('text-lg font-bold tabular-nums', netState.tone)}>
              {summary.netBalance === 0 ? 'Sin pendientes' : formatCurrency(netState.amount)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {details.map(({ label, value, detail, icon: Icon, emphasis }) => (
          <div key={label} className="min-w-0 p-5 sm:[&:nth-child(n+3)]:border-t sm:[&:nth-child(3)]:border-l-0 lg:[&:nth-child(n+3)]:border-t-0 lg:[&:nth-child(3)]:border-l">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-medium">{label}</p>
            </div>
            <p className={cn('mt-3 text-xl font-bold tabular-nums', emphasis ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
              {value}
            </p>
            <p className={cn('mt-1 text-xs', emphasis ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-muted-foreground')}>
              {detail}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost" size="sm" className="justify-between sm:justify-center">
          <Link href={repairsHref}>
            Ver reparaciones <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="justify-between sm:justify-center">
          <Link href={creditsHref}>
            Ver créditos y cuotas <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
