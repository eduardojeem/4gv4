'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_STOREFRONT_STYLE, type StorefrontStyle } from '@/lib/website/storefront-style'

// Fuera de una tienda (dashboard, marketplace) no hay provider: todo queda con
// el aspecto clasico.
const StorefrontStyleContext = createContext<StorefrontStyle>(DEFAULT_STOREFRONT_STYLE)

export function StorefrontStyleProvider({ style, children }: { style: StorefrontStyle; children: ReactNode }) {
  return <StorefrontStyleContext.Provider value={style}>{children}</StorefrontStyleContext.Provider>
}

export function useStorefrontStyle(): StorefrontStyle {
  return useContext(StorefrontStyleContext)
}
