'use client'

import type { ReactNode } from 'react'
import { CartDrawerProvider } from '@/contexts/cart-drawer-context'
import { CartDrawer } from './CartDrawer'

export function CartProviderWithDrawer({ children }: { children: ReactNode }) {
  return (
    <CartDrawerProvider>
      {children}
      <CartDrawer />
    </CartDrawerProvider>
  )
}
