import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Product } from '../types'
import { CONVERTIBLE_STATUSES, discountToHonorQuote, posUnitPrice, quoteCode, type QuoteStatus } from '@/lib/quotes/quote-math'
import { appointmentCode } from '@/lib/agenda/agenda-api'

type QuoteItem = {
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount_rate: number
}

type LoadedDocument = {
  id: string
  number: number
  code: string
  convertible: boolean
  customer_id: string | null
  price_mode: 'retail' | 'wholesale'
  items: QuoteItem[]
}

type Variant = { id: string; price: number; wholesale_price?: number | null }

export type ActiveQuote = { kind: 'quote' | 'appointment'; id: string; number: number; code: string }

type AppointmentRow = {
  id: string
  number: number
  status: string
  sale_id: string | null
  customer_id: string | null
  service_product_id: string | null
  service_name: string
  price: number
}

/** Un presupuesto o un turno, como lista de líneas para el carrito. */
async function fetchDocument(kind: ActiveQuote['kind'], id: string): Promise<{ document: LoadedDocument } | { error: string }> {
  const response = await fetch(kind === 'quote' ? `/api/quotes/${id}` : `/api/agenda/${id}`, { cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) return { error: body.error || (kind === 'quote' ? 'No se pudo abrir el presupuesto' : 'No se pudo abrir el turno') }
  if (kind === 'quote') {
    const quote = body.quote as { id: string; number: number; status: QuoteStatus; customer_id: string | null; price_mode: 'retail' | 'wholesale'; items: QuoteItem[] }
    return { document: { ...quote, code: quoteCode(quote.number), convertible: CONVERTIBLE_STATUSES.includes(quote.status) } }
  }
  const appointment = body.appointment as AppointmentRow
  return {
    document: {
      id: appointment.id,
      number: appointment.number,
      code: appointmentCode(appointment.number),
      convertible: !appointment.sale_id && ['pending', 'confirmed', 'completed'].includes(appointment.status),
      customer_id: appointment.customer_id,
      price_mode: 'retail',
      items: [{
        product_id: appointment.service_product_id,
        variant_id: null,
        description: appointment.service_name,
        quantity: 1,
        unit_price: Number(appointment.price),
        discount_rate: 0,
      }],
    },
  }
}

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
  appointmentId = null,
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
  /** Un turno de la agenda que se cobra (`?appointmentId=...`). */
  appointmentId?: string | null
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

  const kind: ActiveQuote['kind'] | null = quoteId ? 'quote' : appointmentId ? 'appointment' : null
  const documentId = quoteId ?? appointmentId
  const documentKey = kind && documentId ? `${kind}:${documentId}` : null

  useEffect(() => {
    if (!documentKey || !kind || !documentId || !ready || loadedFor.current === documentKey) return
    loadedFor.current = documentKey

    const run = async () => {
      const result = await fetchDocument(kind, documentId)
      const { inventoryProducts, getVariant, addProduct, addVariant, updateItemDiscount, setIsWholesale, setSelectedCustomer, clearCart, onLoaded } = cart.current
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const quote = result.document
      if (!quote.convertible) {
        toast.error(kind === 'quote' ? `El presupuesto ${quote.code} ya no se puede cobrar` : `El turno ${quote.code} ya se cobró o está cancelado`)
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

      setActiveQuote({ kind, id: quote.id, number: quote.number, code: quote.code })
      onLoaded?.()
      const skipped = [
        free ? `${free} línea${free === 1 ? '' : 's'} libre${free === 1 ? '' : 's'} para agregar a mano` : null,
        missing ? `${missing} producto${missing === 1 ? '' : 's'} que ya no está${missing === 1 ? '' : 'n'} en el catálogo` : null,
      ].filter(Boolean)
      toast.success(`${kind === 'quote' ? 'Presupuesto' : 'Turno'} ${quote.code} cargado`, {
        description: [`${loaded} ${kind === 'quote' ? 'producto' : 'servicio'}${loaded === 1 ? '' : 's'} con los precios acordados.`, skipped.length ? `Revisá: ${skipped.join(' y ')}.` : null].filter(Boolean).join(' '),
        duration: 6000,
      })
    }

    void run()
  }, [documentKey, kind, documentId, ready])

  /** Llamar con el id de la venta recién hecha. */
  const markConverted = useCallback(async (saleId: string | undefined) => {
    const quote = activeQuote
    if (!quote || !saleId) return
    setActiveQuote(null)
    const isQuote = quote.kind === 'quote'
    const response = await fetch(isQuote ? `/api/quotes/${quote.id}` : `/api/agenda/${quote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isQuote ? { action: 'convert', sale_id: saleId } : { action: 'link_sale', sale_id: saleId }),
    })
    const label = isQuote ? `El presupuesto ${quote.code}` : `El turno ${quote.code}`
    if (response.ok) toast.success(`${label} quedó ${isQuote ? 'como vendido' : 'atendido y cobrado'}`)
    else toast.error(`La venta se hizo, pero no se pudo actualizar ${label.toLowerCase()}`)
  }, [activeQuote])

  return { activeQuote, clearActiveQuote: () => setActiveQuote(null), markConverted }
}
