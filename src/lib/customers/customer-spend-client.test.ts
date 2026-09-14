import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyCustomerSpend, fetchCustomerSpend } from './customer-spend-client'
import { keepComputedSpend, withEmptySpend, type Customer } from '@/hooks/use-customer-state'

const metricas = (extra: Record<string, unknown> = {}) => ({
  count: 3, purchaseCount: 2, repairCount: 1, total: 900, lastAmount: 300, lastDate: '2026-09-01',
  purchaseTotal: 600, repairTotal: 300, yearTotal: 500, ...extra,
})

afterEach(() => { vi.unstubAllGlobals() })

describe('aplicar lo gastado a cada cliente', () => {
  /** En la base, 23 de 27 clientes con ventas tenían lifetime_value en 0. */
  it('reemplaza las columnas viejas por los totales reales', () => {
    const [cliente] = applyCustomerSpend(
      [{ id: 'c1', created_at: '2025-01-01', lifetime_value: 0, total_purchases: 0 }],
      { c1: metricas() },
    )
    expect(cliente).toMatchObject({
      lifetime_value: 900,
      total_purchases: 2,
      total_repairs: 1,
      total_spent_this_year: 500,
      last_purchase_amount: 300,
      avg_order_value: 300,
      last_visit: '2026-09-01',
      spend_synced: true,
    })
  })

  it('un cliente sin operaciones queda en cero, no con lo que decía la columna', () => {
    const [cliente] = applyCustomerSpend([{ id: 'c2', created_at: '2025-01-01', lifetime_value: 123456 }], {})
    expect(cliente.lifetime_value).toBe(0)
    expect(cliente.last_visit).toBe('2025-01-01')
  })
})

describe('pedir lo gastado al servidor', () => {
  it('parte listas grandes en varias llamadas', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const { ids } = JSON.parse(String(init?.body))
      return { ok: true, json: async () => ({ success: true, data: Object.fromEntries(ids.map((id: string) => [id, metricas()])) }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    const ids = Array.from({ length: 4500 }, (_, i) => `c${i}`)
    const result = await fetchCustomerSpend(ids)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(Object.keys(result)).toHaveLength(4500)
  })

  it('si una tanda falla, falla todo: un parcial se veía como completo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ success: false, error: 'caída' }) })))
    await expect(fetchCustomerSpend(['c1'])).rejects.toThrow('caída')
  })
})

describe('conservar los totales calculados', () => {
  const calculado = { id: 'c1', lifetime_value: 900, total_purchases: 2, last_visit: '2026-09-01', spend_synced: true } as unknown as Customer
  const crudo = { id: 'c1', name: 'Ana nueva', lifetime_value: 0, total_purchases: 0, last_visit: '2025-01-01' } as unknown as Customer

  /** Un evento en tiempo real traía la fila cruda y volvía a mostrar los números viejos. */
  it('una actualización cruda no pisa lo calculado', () => {
    const resultado = keepComputedSpend(crudo, calculado)
    expect(resultado.name).toBe('Ana nueva')
    expect(resultado.lifetime_value).toBe(900)
    expect(resultado.last_visit).toBe('2026-09-01')
  })

  it('si todavía no se calculó, se usa lo que llega', () => {
    expect(keepComputedSpend(crudo, { ...calculado, spend_synced: false } as Customer)).toBe(crudo)
    expect(keepComputedSpend(crudo, null)).toBe(crudo)
  })

  it('un cliente nuevo arranca sin gastos', () => {
    const nuevo = withEmptySpend({ id: 'c9', created_at: '2026-09-13', lifetime_value: 5000 } as unknown as Customer)
    expect(nuevo.lifetime_value).toBe(0)
    expect(nuevo.spend_synced).toBe(true)
  })
})
