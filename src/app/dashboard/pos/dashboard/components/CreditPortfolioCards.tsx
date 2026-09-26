'use client'

import { AlertTriangle, CalendarClock, HandCoins, Loader2, PiggyBank, RefreshCw, Wallet, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { PosStats } from '../hooks/usePosStats'
import type { UseCreditPortfolioReturn } from '../hooks/useCreditPortfolio'

interface CreditPortfolioCardsProps {
  portfolio: UseCreditPortfolioReturn
  /** Creditos de taller del periodo. `null` si la organizacion no tiene taller. */
  repairCredits: PosStats['repairCreditStats'] | null
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: React.ElementType
  label: string
  value: string
  hint: string
  tone?: 'neutral' | 'warn' | 'good'
}) {
  return (
    <Card
      className={cn(
        'border shadow-sm',
        tone === 'warn' && 'border-rose-200/80 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20',
        tone === 'good' && 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
      )}
    >
      <CardContent className="space-y-1 p-5">
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              'h-4 w-4',
              tone === 'warn' ? 'text-rose-600 dark:text-rose-400' : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
            )}
          />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums tracking-tight',
            tone === 'warn' ? 'text-rose-700 dark:text-rose-400' : 'text-foreground'
          )}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

/**
 * La cartera de creditos: cuanto se debe, cuanto esta vencido y cuanto se
 * cobro. La seccion que ya existia («Resumen de Ventas a Crédito») solo mira
 * los creditos de venta OTORGADOS en el periodo, asi que no respondia la
 * pregunta que importa: cuanta plata hay en la calle y cuanta esta atrasada.
 */
export function CreditPortfolioCards({ portfolio, repairCredits }: CreditPortfolioCardsProps) {
  const { state, refetch } = portfolio

  return (
    <section className="space-y-4" aria-labelledby="credit-portfolio-title">
      <div>
        <h3 id="credit-portfolio-title" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <span className="rounded-md bg-rose-100 p-1.5 dark:bg-rose-900/40">
            <HandCoins className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </span>
          Cartera de créditos
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Saldo y mora de toda la cartera al día de hoy —ventas, taller y manuales—. Lo otorgado y lo cobrado
          corresponden al período elegido.
        </p>
      </div>

      {(state.status === 'idle' || state.status === 'loading') && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando cartera de créditos…
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/80 bg-amber-50/60 p-4 dark:border-amber-800/60 dark:bg-amber-950/20">
          <p className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {state.message}
          </p>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      )}

      {state.status === 'ready' && (() => {
        const { portfolio: cartera, period } = state.report
        const sinCartera = cartera.activeCredits === 0 && period.grantedCount === 0 && period.paymentsReceived === 0

        if (sinCartera) {
          return (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              La organización no tiene créditos con saldo ni movimientos en este período.
            </div>
          )
        }

        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Tile
                icon={Wallet}
                label="Saldo por cobrar"
                value={formatCurrency(cartera.outstandingAmount)}
                hint={`${cartera.activeCredits} ${cartera.activeCredits === 1 ? 'crédito con saldo' : 'créditos con saldo'}`}
              />
              <Tile
                icon={AlertTriangle}
                label="Vencido"
                value={formatCurrency(cartera.overdueAmount)}
                hint={
                  cartera.overdueInstallments > 0
                    ? `${cartera.overdueInstallments} ${cartera.overdueInstallments === 1 ? 'cuota' : 'cuotas'} de ${cartera.overdueCustomers} ${cartera.overdueCustomers === 1 ? 'cliente' : 'clientes'}`
                    : 'Ninguna cuota vencida'
                }
                tone={cartera.overdueAmount > 0 ? 'warn' : 'good'}
              />
              <Tile
                icon={CalendarClock}
                label="Vence en 30 días"
                value={formatCurrency(cartera.dueSoonAmount)}
                hint="Cuotas pendientes que vencen de hoy a 30 días"
              />
              <Tile
                icon={PiggyBank}
                label="Cobrado del total financiado"
                value={`${Math.round(cartera.collectionRate)}%`}
                hint="Sobre todo lo financiado en la cartera"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Tile
                icon={HandCoins}
                label="Otorgados en el período"
                value={String(period.grantedCount)}
                hint={`${formatCurrency(period.principalGranted)} de capital`}
              />
              <Tile
                icon={Wallet}
                label="Financiado con intereses"
                value={formatCurrency(period.financedTotal)}
                hint={`${formatCurrency(period.scheduledInterest)} de interés`}
              />
              <Tile
                icon={PiggyBank}
                label="Cobrado en el período"
                value={formatCurrency(period.paymentsReceived)}
                hint="Pagos de cuotas registrados"
              />
            </div>
          </>
        )
      })()}

      {repairCredits && repairCredits.count > 0 && (
        <p className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
          <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            En el período se otorgaron {repairCredits.count}{' '}
            {repairCredits.count === 1 ? 'crédito' : 'créditos'} por reparaciones ({formatCurrency(repairCredits.totalAmount)},
            pendiente {formatCurrency(repairCredits.pendingAmount)}). El detalle está en la pestaña Reparaciones.
          </span>
        </p>
      )}
    </section>
  )
}
