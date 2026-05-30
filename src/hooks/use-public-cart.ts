'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  PUBLIC_CART_EVENT,
  addPublicProductToCart,
  clearPublicCart,
  getPublicCartItems,
  getTenantSlugFromPathname,
  setPublicCartItems,
  type PublicCartItem,
} from '@/lib/public-cart'
import type { PublicProduct } from '@/types/public'

export function usePublicCart() {
  const pathname = usePathname()
  const tenantSlug = useMemo(() => getTenantSlugFromPathname(pathname), [pathname])
  const [items, setItems] = useState<PublicCartItem[]>([])

  const refresh = useCallback(() => {
    setItems(getPublicCartItems(tenantSlug))
  }, [tenantSlug])

  useEffect(() => {
    queueMicrotask(refresh)
    window.addEventListener(PUBLIC_CART_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(PUBLIC_CART_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [items]
  )
  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const next = getPublicCartItems(tenantSlug)
      .map((item) => item.productId === productId ? { ...item, quantity: Math.max(0, Math.min(999, quantity)) } : item)
      .filter((item) => item.quantity > 0)
    setPublicCartItems(tenantSlug, next)
  }, [tenantSlug])

  const removeItem = useCallback((productId: string) => {
    setPublicCartItems(tenantSlug, getPublicCartItems(tenantSlug).filter((item) => item.productId !== productId))
  }, [tenantSlug])

  const clear = useCallback(() => clearPublicCart(tenantSlug), [tenantSlug])

  const addProduct = useCallback((product: PublicProduct, unitPrice: number, quantity = 1) => {
    return addPublicProductToCart({ tenantSlug, product, unitPrice, quantity })
  }, [tenantSlug])

  return { tenantSlug, items, count, subtotal, addProduct, setQuantity, removeItem, clear }
}
