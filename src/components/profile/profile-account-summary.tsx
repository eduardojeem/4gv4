'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  ShoppingBag,
  Store,
  WalletCards,
  Wrench,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import type { CustomerAccountSummary } from '@/lib/profile/customer-account-summary'

export interface StoreCreditByOrganization {
  organization: { id: string; name: string; slug: string; logo_url?: string | null } | null
  amount: number
}

interface ProfileAccountSummaryProps {
  summary: CustomerAccountSummary
  tenantPrefix?: string
  /**
   * Saldo a favor abierto por tienda. El de una no se gasta en otra, asi que el
   * total del resumen no es plata disponible cuando hay mas de una: se muestra
   * el desglose para que se vea de quien es cada parte.
   */
  storeCredits?: StoreCreditByOrganization[]
}

export function ProfileAccountSummary({
  summary,
  tenantPrefix = '',
  storeCredits = [],
}: ProfileAccountSummaryProps) {
  const creditStores = storeCredits.filter((row) => row.amount > 0)
  const splitAcrossStores = creditStores.length > 1
  const repairsHref = tenantPrefix ? `${tenantPrefix}/mis-reparaciones` : '/mis-reparaciones'
  const creditsHref = tenantPrefix === '/marketplace'
    ? '#tiendas'
    : tenantPrefix
      ? `${tenantPrefix}/perfil/creditos`
      : '/perfil/creditos'
  const netState = summary.netBalance > 0
    ? { label: 'Saldo neto a favor', amount: summary.netBalance, tone: 'text-emerald-700 dark:text-emerald-300', icon: WalletCards }
    : summary.netBalance < 0
      ? { label: 'Saldo neto por pagar', amount: Math.abs(summary.netBalance), tone: 'text-amber-700 dark:text-amber-300', icon: AlertTriangle }
      : { label: 'Cuenta al día', amount: 0, tone: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 }
  const NetIcon = netState.icon

  const details = [
    {
      label: 'Cuotas de crédito',
      value: formatCurrency(summary.financing.pendingAmount),
      detail: summary.financing.overdueCount > 0
        ? `${summary.financing.overdueCount} ${summary.financing.overdueCount === 1 ? 'cuota vencida' : 'cuotas vencidas'}`
        : 'Sin cuotas vencidas',
      overdue: summary.financing.overdueAmount > 0
        ? `Vencido: ${formatCurrency(summary.financing.overdueAmount)}`
        : null,
      icon: CreditCard,
      emphasis: summary.financing.overdueCount > 0,
    },
    {
      label: 'Reparaciones por pagar',
      value: formatCurrency(summary.repairs.pendingAmount),
      detail: `${summary.repairs.pendingCount} pendientes · ${summary.repairs.paidCount} pagadas`,
      overdue: null,
      icon: Wrench,
      emphasis: summary.repairs.pendingAmount > 0,
    },
    {
      label: 'Pedidos por pagar',
      value: formatCurrency(summary.orders.pendingAmount),
      detail: `${summary.orders.pendingCount} pendientes · ${summary.orders.paidCount} pagados`,
      overdue: null,
      icon: ShoppingBag,
      emphasis: summary.orders.pendingAmount > 0,
    },
    {
      label: splitAcrossStores ? 'Saldo a favor en tiendas' : 'Saldo disponible a favor',
      value: formatCurrency(summary.storeCredit),
      detail: splitAcrossStores
        ? `Repartido en ${creditStores.length} tiendas · se usa en cada una`
        : 'Disponible para próximas operaciones',
      overdue: null,
      icon: CircleDollarSign,
      emphasis: false,
    },
  ]

  return (
    <section aria-labelledby="account-summary-title" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid gap-4 border-b border-border px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Estado de cuenta</p>
          <h2 id="account-summary-title" className="mt-1 text-base font-semibold text-foreground sm:text-lg">
            Resumen de pagos y saldos
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Primero te mostramos lo que requiere atención.</p>
        </div>
        <div className={cn(
          'flex items-center gap-3 rounded-lg border px-4 py-3 sm:min-w-60',
          summary.netBalance < 0 ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/25 bg-emerald-500/10'
        )}>
          <NetIcon className={cn('h-5 w-5 shrink-0', netState.tone)} aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">{netState.label}</p>
            <p className={cn('text-lg font-bold tabular-nums', netState.tone)}>
              {summary.netBalance === 0 ? 'Sin pendientes' : formatCurrency(netState.amount)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {details.map(({ label, value, detail, overdue, icon: Icon, emphasis }) => (
          <div key={label} className="min-w-0 bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-medium">{label}</p>
            </div>
            <p className={cn('mt-2 text-lg font-bold tabular-nums', emphasis ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
              {value}
            </p>
            <p className={cn('mt-1 text-xs', emphasis ? 'text-amber-700/80 dark:text-amber-300/80' : 'text-muted-foreground')}>
              {detail}
            </p>
            {overdue && <p className="mt-1 text-xs font-semibold text-destructive">{overdue}</p>}
          </div>
        ))}
      </div>

      {splitAcrossStores && (
        <div className="border-t border-border bg-muted/20 px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">
            El saldo a favor es de cada tienda: no se puede usar en otra.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {creditStores.map((row, index) => (
              <li
                key={row.organization?.id ?? `sin-tienda-${index}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-3 py-2"
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {row.organization ? (
                    <Link
                      href={`/${row.organization.slug}/perfil`}
                      className="truncate text-xs font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {row.organization.name}
                    </Link>
                  ) : (
                    <span className="truncate text-xs font-semibold text-muted-foreground">Tienda sin identificar</span>
                  )}
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                  {formatCurrency(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost" size="sm" className="justify-between sm:justify-center">
          <Link href={repairsHref}>
            Ver reparaciones <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="justify-between sm:justify-center">
          <Link href={creditsHref}>
            {tenantPrefix === '/marketplace' ? 'Elegir tienda para ver cuotas' : 'Ver créditos y cuotas'}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
