'use client'

import { Building2, CreditCard, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 'card' paga con tarjeta por Bancard; 'stripe' abre Stripe Checkout y
 * 'transfer' muestra la solicitud de transferencia bancaria.
 */
export type SubscriptionPaymentMethod = 'card' | 'stripe' | 'transfer'

type SubscriptionPaymentMethodSelectorProps = {
  value: SubscriptionPaymentMethod | null
  onChange: (method: SubscriptionPaymentMethod) => void
  disabled?: boolean
  /** Formas de pago visibles pero no elegibles (por ejemplo, faltan datos). */
  disabledMethods?: SubscriptionPaymentMethod[]
  className?: string
  includeCard?: boolean
  includeStripe?: boolean
  includeTransfer?: boolean
}

const options: Array<{
  value: SubscriptionPaymentMethod | null
  label: string
  description: string
  icon: typeof CreditCard
}> = [
  {
    value: 'card',
    label: 'Tarjeta',
    description: 'Crédito o débito · Bancard',
    icon: CreditCard,
  },
  {
    value: 'transfer',
    label: 'Transferencia',
    description: 'Con comprobante',
    icon: Building2,
  },
  {
    value: 'stripe',
    label: 'Stripe',
    description: 'Tarjeta internacional',
    icon: Globe,
  },
]

const GRID_COLUMNS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
}

export function SubscriptionPaymentMethodSelector({
  value,
  onChange,
  disabled = false,
  disabledMethods = [],
  className,
  includeCard = true,
  includeStripe = false,
  includeTransfer = false,
}: SubscriptionPaymentMethodSelectorProps) {
  const visibleOptions = options.filter((option) =>
    (option.value !== 'card' || includeCard) && (option.value !== 'stripe' || includeStripe) && (option.value !== 'transfer' || includeTransfer),
  )
  if (!visibleOptions.length) return <p role="status" className="text-sm text-muted-foreground">No hay medios de pago disponibles. Contactá con soporte para contratar o renovar tu plan.</p>

  return (
    <div
      className={cn('grid gap-1 rounded-md border bg-muted/40 p-1', GRID_COLUMNS[visibleOptions.length], className)}
      role="group"
      aria-label="Forma de pago"
    >
      {visibleOptions.map((option) => {
        const Icon = option.icon
        const selected = value === option.value
        const optionDisabled = disabled || disabledMethods.includes(option.value)

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={optionDisabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex min-h-12 items-center justify-center gap-2 rounded-sm px-3 py-2 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              optionDisabled && 'cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground',
            )}
          >
            <Icon className="h-4 w-4 flex-none" />
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-4">{option.label}</span>
              <span className="block text-xs leading-4 text-muted-foreground">{option.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
