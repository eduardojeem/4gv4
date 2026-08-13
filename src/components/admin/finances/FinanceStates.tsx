import { AlertCircle, CircleDollarSign, RefreshCw } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

export function FinanceLoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando resumen financiero">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32" />)}
      </div>
      <Skeleton className="h-40" />
    </div>
  )
}

export function FinanceErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="No pudimos cargar Finanzas"
      description={`${error.message} Verificá tu conexión e intentá nuevamente.`}
      action={{ label: 'Reintentar', onClick: onRetry, icon: RefreshCw }}
      className="rounded-xl border bg-card"
    />
  )
}

export function FinanceEmptyState() {
  return (
    <EmptyState
      icon={CircleDollarSign}
      title="Todavía no hay movimientos financieros"
      description="Cuando registres ventas, gastos o pagos en este período, aparecerán aquí los indicadores financieros."
      className="rounded-xl border bg-card"
    />
  )
}
