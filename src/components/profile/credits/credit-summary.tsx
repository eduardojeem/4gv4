
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, TrendingUp, CalendarClock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface CreditSummaryProps {
  totalPrincipal: number
  totalPaid: number
  totalPending: number
  nextPaymentAmount: number | null
  nextPaymentDate: string | null
  hasLateInstallments: boolean
}

export function CreditSummary({
  totalPrincipal,
  totalPaid,
  totalPending,
  nextPaymentAmount,
  nextPaymentDate,
  hasLateInstallments
}: CreditSummaryProps) {
  const progressPercentage = totalPrincipal > 0 ? (totalPaid / totalPrincipal) * 100 : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Saldo Pendiente */}
      <Card className={cn(
        "border-l-4 shadow-sm",
        hasLateInstallments ? "border-l-destructive" : "border-l-primary"
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Deuda Pendiente</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Gs. {totalPending.toLocaleString('es-PY')}</div>
          {hasLateInstallments && (
            <p className="text-xs text-destructive mt-1 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Cuotas atrasadas
            </p>
          )}
          {!hasLateInstallments && (
            <p className="text-xs text-muted-foreground mt-1">
              Total a pagar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progreso de Pago */}
      <Card className="border-l-4 border-l-success shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Gs. {totalPaid.toLocaleString('es-PY')}</div>
          <div className="mt-2 space-y-1">
            <Progress value={progressPercentage} className="h-2" indicatorColor="var(--success)" />
            <p className="text-xs text-muted-foreground text-right">
              {progressPercentage.toFixed(0)}% pagado
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Próximo Vencimiento */}
      <Card className="border-l-4 border-l-warning shadow-sm md:col-span-2 lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Próximo Vencimiento</CardTitle>
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {nextPaymentAmount !== null ? (
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold">Gs. {nextPaymentAmount.toLocaleString('es-PY')}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Vence el <span className="font-medium text-foreground">{new Date(nextPaymentDate!).toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </p>
              </div>
              <div className="text-xs px-2 py-1 bg-warning/10 text-warning rounded-md border border-warning/20">
                Pendiente
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full justify-center">
              <div className="text-lg font-medium text-muted-foreground">¡Estás al día!</div>
              <p className="text-xs text-muted-foreground">No tienes vencimientos próximos.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
