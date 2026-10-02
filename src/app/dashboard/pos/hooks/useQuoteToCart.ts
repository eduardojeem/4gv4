import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Product } from '../types'
import { CONVERTIBLE_STATUSES, discountToHonorQuote, posUnitPrice, quoteCode, type QuoteStatus } from '@/lib/quotes/quote-math'

type QuoteItem = {
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount_rate: number
}

type LoadedQuote = {
  id: string
  number: number
  status: QuoteStatus
  customer_id: string | null
  price_mode: 'retail' | 'wholesale'
  items: QuoteItem[]
}

type Variant = { id: string; price: number; wholesale_price?: number | null }

export type ActiveQuote = { id: string; number: number }

/**
 * Carga un presupuesto en el carrito del POS (`/dashboard/pos?quoteId=…`).
 *
 * El POS cobra el precio de catálogo y acepta descuentos por línea: para
 * respetar lo presupuestado se aplica el descuento que lleva el precio actual
 * al acordado. Cuando la venta se completa, el presupuesto queda «Vendido» y
 * enlazado a la venta.
 */
export function useQuoteToCart({
  quoteId,
  ready,
  inventoryProducts,
  getVariant,
  addProduct,
  addVariant,
  updateItemDiscount,
  setIsWholesale,
  setSelectedCustomer,
  clearCart,
  onLoaded,
}: {
  quoteId: string | null
  ready: boolean
  inventoryProducts: Product[]
  getVariant: (productId: string, variantId: string) => Variant | null
  addProduct: (product: Product, quantity: number) => void
  addVariant: (variant: Variant, quantity: number) => void
  updateItemDiscount: (cartItemId: string, discount: number) => void
  setIsWholesale: (value: boolean) => void
  setSelectedCustomer: (customerId: string) => void
  clearCart: (silent?: boolean) => void
  onLoaded?: () => void
}) {
  const [activeQuote, setActiveQuote] = useState<ActiveQuote | null>(null)
  const loadedFor = useRef<string | null>(null)
  // Las funciones del carrito cambian en cada render: se leen siempre las últimas,
  // así un refresco del catálogo no corta la carga a la mitad.
  const cart = useRef({ inventoryProducts, getVariant, addProduct, addVariant, updateItemDiscount, setIsWholesale, setSelectedCustomer, clearCart, onLoaded })
  useEffect(() => {
    cart.current = { inventoryProducts, getVariant, addProduct, addVariant, updateItemDiscount, setIsWholesale, setSelectedCustomer, clearCart, onLoaded }
  })

  useEffect(() => {
    if (!quoteId || !ready || loadedFor.current === quoteId) return
    loadedFor.current = quoteId

    const run = async () => {
      const response = await fetch(`/api/quotes/${quoteId}`, { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      const { inventoryProducts, getVariant, addProduct, addVariant, updateItemDiscount, setIsWholesale, setSelectedCustomer, clearCart, onLoaded } = cart.current
      if (!response.ok) {
        toast.error(body.error || 'No se pudo abrir el presupuesto')
        return
      }
      const quote = body.quote as LoadedQuote
      if (!CONVERTIBLE_STATUSES.includes(quote.status)) {
        toast.error(`El presupuesto ${quoteCode(quote.number)} ya no se puede cobrar`)
        return
      }

      const mode = quote.price_mode
      clearCart(true)
      setIsWholesale(mode === 'wholesale')
      if (quote.customer_id) setSelectedCustomer(quote.customer_id)

      let loaded = 0
      let free = 0
      let missing = 0
      for (const item of quote.items) {
        if (!item.product_id) {
          free += 1
          continue
        }
        const quantity = Math.max(1, Number(item.quantity) || 1)
        const net = Number(item.unit_price) * (1 - Number(item.discount_rate || 0) / 100)
        let cartItemId: string
        let current: number

        if (item.variant_id) {
          const variant = getVariant(item.product_id, item.variant_id)
          if (!variant) {
            missing += 1
            continue
          }
          addVariant(variant, quantity)
          cartItemId = variant.id
          current = posUnitPrice({ sale_price: Number(variant.price), wholesale_price: variant.wholesale_price }, mode)
        } else {
          const product = inventoryProducts.find((candidate) => candidate.id === item.product_id)
          if (!product || product.is_active === false) {
            missing += 1
            continue
          }
          addProduct(product, quantity)
          cartItemId = product.id
          current = posUnitPrice({ sale_price: Number(product.sale_price), wholesale_price: product.wholesale_price }, mode)
        }

        const discount = discountToHonorQuote(current, net)
        if (discount > 0) updateItemDiscount(cartItemId, discount)
        loaded += 1
      }

      setActiveQuote({ id: quote.id, number: quote.number })
      onLoaded?.()
      const skipped = [
        free ? `${free} línea${free === 1 ? '' : 's'} libre${free === 1 ? '' : 's'} para agregar a mano` : null,
        missing ? `${missing} producto${missing === 1 ? '' : 's'} que ya no está${missing === 1 ? '' : 'n'} en el catálogo` : null,
      ].filter(Boolean)
      toast.success(`Presupuesto ${quoteCode(quote.number)} cargado`, {
        description: [`${loaded} producto${loaded === 1 ? '' : 's'} con los precios presupuestados.`, skipped.length ? `Revisá: ${skipped.join(' y ')}.` : null].filter(Boolean).join(' '),
        duration: 6000,
      })
    }

    void run()
  }, [quoteId, ready])

  /** Llamar con el id de la venta recién hecha. */
  const markConverted = useCallback(async (saleId: string | undefined) => {
    const quote = activeQuote
    if (!quote || !saleId) return
    setActiveQuote(null)
    const response = await fetch(`/api/quotes/${quote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert', sale_id: saleId }),
    })
    if (response.ok) toast.success(`Presupuesto ${quoteCode(quote.number)} marcado como vendido`)
    else toast.error(`La venta se hizo, pero no se pudo marcar el presupuesto ${quoteCode(quote.number)} como vendido`)
  }, [activeQuote])

  return { activeQuote, clearActiveQuote: () => setActiveQuote(null), markConverted }
}
