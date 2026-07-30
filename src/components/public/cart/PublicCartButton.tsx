'use client'

import { useEffect, useRef, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePublicCart } from '@/hooks/use-public-cart'
import { useCartDrawer } from '@/contexts/cart-drawer-context'
import { cn } from '@/lib/utils'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'

export function PublicCartButton() {
  const { count } = usePublicCart()
  const { open }  = useCartDrawer()
  const { settings, isLoading } = useWebsiteSettings()

  // Bump animation whenever a new item is added
  const prevCount = useRef(count)
  const [bump, setBump] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Keep the server and first client render identical even when SWR is warm.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (count > prevCount.current) {
      // Cart updates come from external storage events; local state only drives the brief bump.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBump(true)
      const t = setTimeout(() => setBump(false), 500)
      return () => clearTimeout(t)
    }
    prevCount.current = count
  }, [count])

  if (!mounted || isLoading || (settings && settings.checkout.commerceMode !== 'cart')) {
    return null
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'relative gap-2 rounded-lg transition-transform duration-150',
        bump && 'scale-110'
      )}
      onClick={open}
      aria-label={`Abrir carrito${count > 0 ? ` — ${count} unidad${count !== 1 ? 'es' : ''}` : ''}`}
    >
      <ShoppingCart className={cn('h-4 w-4 transition-transform duration-150', bump && 'scale-125')} />
      <span className="hidden sm:inline">Carrito</span>
      {count > 0 && (
        <span
          className={cn(
            'absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground transition-transform duration-150',
            bump && 'scale-125'
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Button>
  )
}
