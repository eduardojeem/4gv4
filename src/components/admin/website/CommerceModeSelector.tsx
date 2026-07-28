'use client'

import { Eye, MessageCircle, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PublicCommerceMode } from '@/types/website-settings'

const COMMERCE_MODES = [
  {
    value: 'cart',
    label: 'Carrito y pedidos',
    description: 'Los clientes agregan productos y confirman el pedido desde la tienda.',
    icon: ShoppingCart,
  },
  {
    value: 'whatsapp',
    label: 'Consultas por WhatsApp',
    description: 'Reemplaza la compra por un botón para consultar cada producto.',
    icon: MessageCircle,
  },
  {
    value: 'catalog',
    label: 'Solo catálogo',
    description: 'Muestra productos y precios sin acciones de compra o consulta.',
    icon: Eye,
  },
] satisfies Array<{
  value: PublicCommerceMode
  label: string
  description: string
  icon: typeof ShoppingCart
}>

export function CommerceModeSelector({
  value,
  onChange,
}: {
  value: PublicCommerceMode
  onChange: (value: PublicCommerceMode) => void
}) {
  return (
    <section aria-labelledby="commerce-mode-title" className="rounded-lg border bg-background p-4">
      <div>
        <h2 id="commerce-mode-title" className="text-sm font-semibold">Modo de venta pública</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Esta opción afecta solamente la tienda pública. El POS y las ventas internas siguen funcionando.
        </p>
      </div>

      <div role="radiogroup" aria-label="Modo de venta pública" className="mt-4 grid gap-3 md:grid-cols-3">
        {COMMERCE_MODES.map(({ value: mode, label, description, icon: Icon }) => {
          const selected = value === mode

          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(mode)}
              className={cn(
                'flex min-h-28 items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'hover:border-primary/30 hover:bg-muted/20'
              )}
            >
              <span className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
