'use client'

import { CreditCard, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CheckoutEligibility } from '../lib/checkout-eligibility'

type POSMobileCheckoutBarProps = {
  itemCount: number
  totalLabel: string
  eligibility: CheckoutEligibility
  onOpenCart: () => void
  onCheckout: () => void
}

export function POSMobileCheckoutBar({ itemCount, totalLabel, eligibility, onOpenCart, onCheckout }: POSMobileCheckoutBarProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
      <button type="button" onClick={onOpenCart} aria-label="Abrir carrito" className="relative min-h-11 min-w-11 rounded-xl border border-border/60 px-3 py-2 text-left hover:bg-muted/50">
        <span className="block text-[11px] text-muted-foreground">{itemCount} items en carrito</span>
        <span className="block text-[13px] font-bold">{totalLabel}</span>
        <ShoppingCart className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
      </button>
      <Button
        className="min-h-11 min-w-11 rounded-xl px-5 text-sm font-bold"
        onClick={onCheckout}
        disabled={!eligibility.canConfirm}
        aria-disabled={!eligibility.canConfirm}
        aria-label="Cobrar venta"
        title={eligibility.reason}
      >
        <CreditCard className="mr-2 h-5 w-5" aria-hidden="true" />
        Cobrar
      </Button>
    </div>
  )
}
