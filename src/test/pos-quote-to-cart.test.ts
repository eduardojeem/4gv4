import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useQuoteToCart } from '@/app/dashboard/pos/hooks/useQuoteToCart'
import type { Product } from '@/app/dashboard/pos/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const product = (id: string, sale: number, wholesale: number | null = null) =>
  ({ id, name: id, sale_price: sale, wholesale_price: wholesale, stock_quantity: 10, is_active: true }) as unknown as Product

function quoteResponse(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      quote: {
        id: 'q1',
        number: 12,
        status: 'sent',
        customer_id: 'c1',
        price_mode: 'retail',
        items: [
          // Presupuestado a 100.000; hoy el catálogo dice 125.000.
          { product_id: 'p1', variant_id: null, description: 'Pantalla', quantity: 2, unit_price: 125000, discount_rate: 20 },
          { product_id: 'p2', variant_id: null, description: 'Funda', quantity: 1, unit_price: 50000, discount_rate: 0 },
          { product_id: null, variant_id: null, description: 'Mano de obra', quantity: 1, unit_price: 80000, discount_rate: 0 },
          { product_id: 'v-prod', variant_id: 'v1', description: 'Remera M', quantity: 3, unit_price: 60000, discount_rate: 0 },
        ],
        ...over,
      },
    }),
  }
}

afterEach(() => vi.unstubAllGlobals())

function setup(quoteId: string | null = 'q1') {
  const calls = {
    addProduct: vi.fn(),
    addVariant: vi.fn(),
    updateItemDiscount: vi.fn(),
    setIsWholesale: vi.fn(),
    setSelectedCustomer: vi.fn(),
    clearCart: vi.fn(),
    onLoaded: vi.fn(),
  }
  const hook = renderHook(() => useQuoteToCart({
    quoteId,
    ready: true,
    inventoryProducts: [product('p1', 125000), product('p2', 45000)],
    getVariant: (_productId, variantId) => (variantId === 'v1' ? { id: 'v1', price: 70000, wholesale_price: null } : null),
    ...calls,
  }))
  return { hook, calls }
}

describe('presupuesto → POS', () => {
  it('carga los productos, respeta los precios acordados y salta las líneas libres', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(quoteResponse()))
    const { hook, calls } = setup()

    await waitFor(() => expect(hook.result.current.activeQuote).toEqual({ id: 'q1', number: 12 }))
    expect(calls.clearCart).toHaveBeenCalledWith(true)
    expect(calls.setIsWholesale).toHaveBeenCalledWith(false)
    expect(calls.setSelectedCustomer).toHaveBeenCalledWith('c1')
    expect(calls.addProduct).toHaveBeenCalledTimes(2)
    expect(calls.addVariant).toHaveBeenCalledWith({ id: 'v1', price: 70000, wholesale_price: null }, 3)
    // p1: 125.000 con 20% = 100.000 acordado. p2 bajó a 45.000: se cobra el precio nuevo, sin descuento.
    expect(calls.updateItemDiscount).toHaveBeenCalledWith('p1', 20)
    expect(calls.updateItemDiscount).not.toHaveBeenCalledWith('p2', expect.anything())
    // La variante subió de 60.000 a 70.000: descuento hasta lo presupuestado.
    expect(calls.updateItemDiscount).toHaveBeenCalledWith('v1', expect.closeTo(14.2857, 3))
    expect(calls.onLoaded).toHaveBeenCalled()
  })

  it('no carga un presupuesto ya vendido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(quoteResponse({ status: 'converted' })))
    const { hook, calls } = setup()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(calls.addProduct).not.toHaveBeenCalled()
    expect(hook.result.current.activeQuote).toBeNull()
  })

  it('al cobrar, enlaza la venta con el presupuesto', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(quoteResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const { hook } = setup()
    await waitFor(() => expect(hook.result.current.activeQuote).not.toBeNull())

    await act(() => hook.result.current.markConverted('sale-9'))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/quotes/q1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ action: 'convert', sale_id: 'sale-9' }),
    }))
    expect(hook.result.current.activeQuote).toBeNull()
  })
})
