'use client'

import { CreditCard, Globe, QrCode } from 'lucide-react'
import type { PagoparPaymentMethod } from '@/lib/payments/pagopar'
import { cn } from '@/lib/utils'

/** Tarjeta y QR van por Pagopar; 'stripe' abre Stripe Checkout. */
export type SubscriptionPaymentMethod = PagoparPaymentMethod | 'stripe'

type PagoparPaymentMethodSelectorProps = {
  value: SubscriptionPaymentMethod
  onChange: (method: SubscriptionPaymentMethod) => void
  disabled?: boolean
  className?: string
  includeStripe?: boolean
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
    value: 'stripe',
    label: 'Stripe',
    description: 'Tarjeta internacional',
    icon: Globe,
  },
]

export function PagoparPaymentMethodSelector({
  value,
  onChange,
  disabled = false,
  className,
  includeStripe = false,
}: PagoparPaymentMethodSelectorProps) {
  const visibleOptions = includeStripe ? options : options.filter((option) => option.value !== 'stripe')

  return (
    <div
      className={cn('grid gap-1 rounded-md border bg-muted/40 p-1', includeStripe ? 'grid-cols-3' : 'grid-cols-2', className)}
      role="group"
      aria-label={includeStripe ? 'Forma de pago' : 'Forma de pago con Pagopar'}
    >
      {visibleOptions.map((option) => {
        const Icon = option.icon
        const selected = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex min-h-12 items-center justify-center gap-2 rounded-sm px-3 py-2 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-60',
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
