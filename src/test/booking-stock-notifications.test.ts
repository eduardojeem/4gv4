import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  products: [] as Array<Record<string, unknown>>,
  inventory: [] as Array<Record<string, unknown>>,
}))
vi.mock('@/lib/notifications/server/dispatcher', () => ({ dispatchNotificationEvent: mocks.dispatch }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      const rows = table === 'branch_inventory' ? mocks.inventory : mocks.products
      const query = { select: () => query, eq: () => query, in: async () => ({ data: rows, error: null }) }
      return query
    },
  }),
}))

import {
  classifyStockLevel,
  notifyAppointmentChanged,
  notifyStockLevelsAfterSale,
} from '@/lib/notifications/server/business-events'
import { formatNotificationContent } from '@/lib/notifications/server/content'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

afterEach(() => {
  vi.clearAllMocks()
  mocks.products = []
  mocks.inventory = []
})

describe('avisos de turnos (lo que hace el cliente desde la web)', () => {
  it('reserva, cambio y cancelación usan su tipo y el texto de la Agenda', async () => {
    mocks.dispatch.mockResolvedValue({})
    for (const kind of ['booked', 'rescheduled', 'cancelled'] as const) {
      await notifyAppointmentChanged({ organizationId: 'org', appointmentId: 'a1', kind, text: `texto ${kind}` })
    }
    expect(mocks.dispatch.mock.calls.map(([event]) => [event.type, event.data.text, event.actorUserId])).toEqual([
      ['BOOKING_CREATED', 'texto booked', null],
      ['BOOKING_RESCHEDULED', 'texto rescheduled', null],
      ['BOOKING_CANCELLED', 'texto cancelled', null],
    ])
  })

  it('el aviso muestra el texto armado por la Agenda', () => {
    expect(formatNotificationContent('BOOKING_CREATED', { text: 'Ana reservó Corte para el lunes 24, 10:00.' }).body)
      .toBe('Ana reservó Corte para el lunes 24, 10:00.')
    expect(formatNotificationContent('BOOKING_CANCELLED', {}).body).toBe('Una reserva fue cancelada.')
  })

  it('en barberías y belleza dice «turno»; en el resto, «reserva»', () => {
    expect(formatNotificationContent('BOOKING_CREATED', {}, { businessVertical: 'barbershop' }).title).toBe('Nuevo turno')
    expect(formatNotificationContent('BOOKING_CANCELLED', {}, { businessVertical: 'beauty_services' }).title).toBe('Turno cancelado')
    expect(formatNotificationContent('BOOKING_CREATED', {}, { businessVertical: 'electronics' }).title).toBe('Nueva reserva')
    expect(formatNotificationContent('REPAIR_READY', {}, { businessVertical: 'barbershop' }).title).toBe('Reparación lista')
  })

  it('se dispara desde el registro de novedades del turno, sin bloquear la reserva', () => {
    const events = read('src/lib/agenda/appointment-events.ts')
    expect(events).toMatch(/afterResponse\(\(\) => notifyAppointmentChanged\(/)
    // Se avisa aunque la tienda no quiera email: el push va antes del corte.
    expect(events.indexOf('notifyAppointmentChanged(')).toBeLessThan(events.indexOf('if (!options.notifyEmail) return'))
  })
})

describe('avisos de stock después de vender', () => {
  it('clasifica agotado, stock bajo o nada', () => {
    expect(classifyStockLevel({ stock: 0, minStock: 5 })).toBe('OUT_OF_STOCK')
    expect(classifyStockLevel({ stock: -1, minStock: null })).toBe('OUT_OF_STOCK')
    expect(classifyStockLevel({ stock: 3, minStock: 5 })).toBe('LOW_STOCK')
    expect(classifyStockLevel({ stock: 5, minStock: 5 })).toBe('LOW_STOCK')
    expect(classifyStockLevel({ stock: 6, minStock: 5 })).toBeNull()
    expect(classifyStockLevel({ stock: 2, minStock: null })).toBeNull()
  })

  it('con sucursal usa su inventario y su mínimo; un aviso por día y producto', async () => {
    mocks.dispatch.mockResolvedValue({})
    mocks.products = [
      { id: 'p1', name: 'Funda A54', stock_quantity: 50, min_stock: 2, unit_measure: 'unidad', is_active: true },
      { id: 'p2', name: 'Cargador', stock_quantity: 50, min_stock: null, unit_measure: 'unidad', is_active: true },
      { id: 'p3', name: 'Cambio de pantalla', stock_quantity: 0, min_stock: null, unit_measure: 'servicio', is_active: true },
      { id: 'p4', name: 'Vidrio templado', stock_quantity: 0, min_stock: null, unit_measure: 'unidad', is_active: false },
    ]
    mocks.inventory = [
      { product_id: 'p1', stock_quantity: 1, min_stock: 3 },
      { product_id: 'p2', stock_quantity: 0, min_stock: null },
    ]
    await notifyStockLevelsAfterSale({ organizationId: 'org', branchId: 'b1', productIds: ['p1', 'p2', 'p3', 'p4', 'p1'], now: new Date('2026-11-21T12:00:00Z') })
    expect(mocks.dispatch.mock.calls.map(([event]) => [event.type, event.resourceId, event.idempotencyKey])).toEqual([
      ['LOW_STOCK', 'p1', 'stock:LOW_STOCK:p1:b1:2026-11-21'],
      ['OUT_OF_STOCK', 'p2', 'stock:OUT_OF_STOCK:p2:b1:2026-11-21'],
    ])
  })

  it('sin sucursal usa el stock del producto', async () => {
    mocks.dispatch.mockResolvedValue({})
    mocks.products = [{ id: 'p1', name: 'Funda', stock_quantity: 2, min_stock: 2, unit_measure: 'unidad', is_active: true }]
    await notifyStockLevelsAfterSale({ organizationId: 'org', branchId: null, productIds: ['p1'], now: new Date('2026-11-21T12:00:00Z') })
    expect(mocks.dispatch.mock.calls[0][0]).toMatchObject({ type: 'LOW_STOCK', idempotencyKey: 'stock:LOW_STOCK:p1:org:2026-11-21', data: { productName: 'Funda', stock: 2, minStock: 2 } })
  })

  it('los textos dicen qué producto y cuánto queda', () => {
    expect(formatNotificationContent('LOW_STOCK', { productName: 'Funda A54', stock: 1 }).body).toBe('Funda A54 llegó al stock mínimo. Quedan 1.')
    expect(formatNotificationContent('OUT_OF_STOCK', { productName: 'Cargador' }).body).toBe('Cargador se quedó sin stock.')
  })

  it('la venta del POS revisa el stock de lo vendido después de responder', () => {
    const route = read('src/app/api/pos/process-sale/route.ts')
    expect(route).toContain('afterResponse(() => notifyStockLevelsAfterSale({ organizationId: organization.id, branchId, productIds: soldProductIds }))')
  })
})
