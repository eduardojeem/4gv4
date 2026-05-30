'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type CartDrawerContextType = {
  isOpen: boolean
  open: () => void
  close: () => void
}

const CartDrawerContext = createContext<CartDrawerContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
})

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <CartDrawerContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </CartDrawerContext.Provider>
  )
}

export const useCartDrawer = () => useContext(CartDrawerContext)
