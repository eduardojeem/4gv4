import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import {
  getRepairFinancialPresentation,
  type RepairFinancialPresentationInput,
} from '@/lib/repairs/financial-closure'
import { cn } from '@/lib/utils'

interface RepairPaymentIndicatorProps extends RepairFinancialPresentationInput {
  className?: string
  compact?: boolean
}

export function RepairPaymentIndicator({
  className,
  compact = false,
  ...repair
}: RepairPaymentIndicatorProps) {
  const financial = getRepairFinancialPresentation(repair)

  const presentation = !financial.priceDefined
    ? financial.paid > 0
      ? {
          label: 'Anticipo · precio pendiente',
          detail: compact ? null : `Recibido ${formatCurrency(financial.paid)}`,
          icon: Clock3,
          colors: 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
        }
      : {
          label: 'Precio pendiente',
          detail: compact ? null : 'Saldo por calcular',
          icon: Clock3,
          colors: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
        }
    : financial.status === 'pagado'
      ? {
          label: 'Pagado',
          detail: null,
          icon: CheckCircle2,
          colors: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
        }
      : {
          label: financial.delivered
            ? 'Entregado con saldo pendiente'
            : financial.status === 'parcial'
              ? 'Pago parcial'
              : 'Sin pagos',
          detail: `Falta ${formatCurrency(financial.balance)}`,
          icon: AlertCircle,
          colors: financial.delivered
            ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200'
            : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
        }

  const Icon = presentation.icon

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} aria-label="Estado financiero de la reparación">
      <Badge variant="outline" className={cn('gap-1 whitespace-nowrap px-1.5 py-0 text-[10px] font-bold', presentation.colors)}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        {presentation.label}
      </Badge>
      {presentation.detail && (
        <span className={cn('whitespace-nowrap font-semibold tabular-nums', compact ? 'text-[10px]' : 'text-xs')}>
          {presentation.detail}
        </span>
      )}
    </div>
  )
}
