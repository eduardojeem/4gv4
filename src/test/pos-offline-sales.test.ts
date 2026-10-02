import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addToOutbox, listOutbox, memoryStorage, setOutboxStorage } from '@/lib/pos-offline/outbox'
import { isNetworkError, offlineBlockReason, syncOutbox } from '@/lib/pos-offline/sync'

const sale = (id: string, createdAt: string) => ({
  id,
  branchId: 'branch-1',
  payload: { p_items: [{ product_id: 'p1', quantity: 1 }], p_session_id: 's1' },
  total: 50000,
  itemCount: 1,
  summary: 'Cargador',
  createdAt,
})

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response

beforeEach(() => setOutboxStorage(memoryStorage()))
afterEach(() => setOutboxStorage(null))

describe('ventas sin conexión', () => {
  it('se mandan en orden, con su clave y su sucursal, y salen de la cola', async () => {
    await addToOutbox(sale('b', '2026-10-01T10:05:00Z'))
    await addToOutbox(sale('a', '2026-10-01T10:00:00Z'))
    const fetchMock = vi.fn().mockResolvedValue(json(200, { success: true, saleId: 'x' }))

    const result = await syncOutbox(fetchMock)

    expect(result).toEqual({ sent: 2, failed: 0, stopped: null })
    expect(fetchMock.mock.calls.map(([, init]) => (init.headers as Record<string, string>)['x-idempotency-key'])).toEqual(['a', 'b'])
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>)['x-branch-id']).toBe('branch-1')
    expect(await listOutbox()).toEqual([])
  })

  it('una rechazada queda para revisar y las demás se siguen mandando', async () => {
    await addToOutbox(sale('a', '2026-10-01T10:00:00Z'))
    await addToOutbox(sale('b', '2026-10-01T10:05:00Z'))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(409, { success: false, error: 'La caja está cerrada' }))
      .mockResolvedValueOnce(json(200, { success: true }))

    const result = await syncOutbox(fetchMock)

    expect(result).toEqual({ sent: 1, failed: 1, stopped: null })
    const [left] = await listOutbox()
    expect(left).toMatchObject({ id: 'a', status: 'error', lastError: 'La caja está cerrada', attempts: 1 })
  })

  it('sin red se corta y no pierde nada', async () => {
    await addToOutbox(sale('a', '2026-10-01T10:00:00Z'))
    await addToOutbox(sale('b', '2026-10-01T10:05:00Z'))
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await syncOutbox(fetchMock)

    expect(result.stopped).toBe('offline')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((await listOutbox()).map((row) => row.status)).toEqual(['pending', 'pending'])
  })

  it('con la sesión vencida espera a que se vuelva a entrar', async () => {
    await addToOutbox(sale('a', '2026-10-01T10:00:00Z'))
    const result = await syncOutbox(vi.fn().mockResolvedValue(json(401, { error: 'Unauthorized' })))
    expect(result.stopped).toBe('auth')
    expect((await listOutbox())[0]).toMatchObject({ status: 'pending', attempts: 1 })
  })

  it('dos sincronizaciones a la vez no mandan la venta dos veces', async () => {
    await addToOutbox(sale('a', '2026-10-01T10:00:00Z'))
    const fetchMock = vi.fn().mockResolvedValue(json(200, { success: true }))
    await Promise.all([syncOutbox(fetchMock), syncOutbox(fetchMock)])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('lo que necesita validar en el servidor no se vende sin conexión', () => {
    expect(offlineBlockReason({ payments: [{ payment_method: 'cash' }] })).toBeNull()
    expect(offlineBlockReason({ payments: [{ payment_method: 'card' }, { payment_method: 'transfer' }] })).toBeNull()
    expect(offlineBlockReason({ payments: [{ payment_method: 'credit' }] })).toMatch(/crédito/)
    expect(offlineBlockReason({ payments: [], store_credit_amount: 1000 })).toMatch(/saldo/)
    expect(offlineBlockReason({ payments: [], repair_ids: ['r1'] })).toMatch(/reparaciones/)
  })

  it('distingue la falta de red de un error del servidor', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('La caja está cerrada'))).toBe(false)
  })
})
