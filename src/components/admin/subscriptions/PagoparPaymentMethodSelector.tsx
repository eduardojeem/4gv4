'use client'

import { Building2, CreditCard, Globe, QrCode } from 'lucide-react'
import type { PagoparPaymentMethod } from '@/lib/payments/pagopar'
import { cn } from '@/lib/utils'

/**
 * Tarjeta y QR van por Pagopar; 'stripe' abre Stripe Checkout y 'transfer'
 * muestra la solicitud de transferencia bancaria.
 */
export type SubscriptionPaymentMethod = PagoparPaymentMethod | 'stripe' | 'transfer'

type PagoparPaymentMethodSelectorProps = {
  value: SubscriptionPaymentMethod
  onChange: (method: SubscriptionPaymentMethod) => void
  disabled?: boolean
  /** Formas de pago visibles pero no elegibles (por ejemplo, faltan datos). */
  disabledMethods?: SubscriptionPaymentMethod[]
  className?: string
  includeStripe?: boolean
  includeTransfer?: boolean
}

const options: Array<{
  value: SubscriptionPaymentMethod
  label: string
  description: string
  icon: typeof CreditCard
}> = [
  {
    value: 'card',
    label: 'Tarjeta',
    description: 'Crédito o débito',
    icon: CreditCard,
  },
  {
    value: 'qr',
    label: 'Pago QR',
    description: 'App bancaria',
    icon: QrCode,
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

export function PagoparPaymentMethodSelector({
  value,
  onChange,
  disabled = false,
  disabledMethods = [],
  className,
  includeStripe = false,
  includeTransfer = false,
}: PagoparPaymentMethodSelectorProps) {
  const visibleOptions = options.filter((option) =>
    (option.value !== 'stripe' || includeStripe) && (option.value !== 'transfer' || includeTransfer),
  )
  const onlyPagopar = !includeStripe && !includeTransfer

  return (
    <div
      className={cn('grid gap-1 rounded-md border bg-muted/40 p-1', GRID_COLUMNS[visibleOptions.length], className)}
      role="group"
      aria-label={onlyPagopar ? 'Forma de pago con Pagopar' : 'Forma de pago'}
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
