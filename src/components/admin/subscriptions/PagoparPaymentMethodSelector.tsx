'use client'

import { CreditCard, QrCode } from 'lucide-react'
import type { PagoparPaymentMethod } from '@/lib/payments/pagopar'
import { cn } from '@/lib/utils'

type PagoparPaymentMethodSelectorProps = {
  value: PagoparPaymentMethod
  onChange: (method: PagoparPaymentMethod) => void
  disabled?: boolean
  className?: string
}

const options: Array<{
  value: PagoparPaymentMethod
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
]

export function PagoparPaymentMethodSelector({
  value,
  onChange,
  disabled = false,
  className,
}: PagoparPaymentMethodSelectorProps) {
  return (
    <div
      className={cn('grid grid-cols-2 gap-1 rounded-md border bg-muted/40 p-1', className)}
      role="group"
      aria-label="Forma de pago con Pagopar"
    >
      {options.map((option) => {
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
