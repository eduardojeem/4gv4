import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }))
vi.mock('@/lib/notifications/server/dispatcher', () => ({ dispatchNotificationEvent: mocks.dispatch }))

import { notifyOrderCreated, notifyRepairCreated, notifySaleCreated } from '@/lib/notifications/server/business-events'
import { formatNotificationContent } from '@/lib/notifications/server/content'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

afterEach(() => vi.clearAllMocks())

describe('avisos de ventas, pedidos y reparaciones', () => {
  it('una venta avisa al resto del equipo, no al cajero, y una grande avisa aparte', async () => {
    mocks.dispatch.mockResolvedValue({})
    await notifySaleCreated({ organizationId: 'org', branchId: 'b1', saleId: 's1', actorUserId: 'cajero', total: 2_500_000 })

    expect(mocks.dispatch).toHaveBeenCalledTimes(2)
    expect(mocks.dispatch.mock.calls.map(([event]) => event.type)).toEqual(['SALE_CREATED', 'LARGE_SALE'])
    expect(mocks.dispatch.mock.calls[0][0]).toMatchObject({ resourceId: 's1', branchId: 'b1', excludeUserIds: ['cajero'] })
  })

  it('un error al avisar nunca rompe la venta', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.dispatch.mockRejectedValueOnce(new Error('expo caído'))
    await expect(notifySaleCreated({ organizationId: 'org', branchId: null, saleId: 's2', actorUserId: 'u', total: 10 })).resolves.toBeUndefined()
  })

  it('pedido online y reparación con técnico asignado', async () => {
    mocks.dispatch.mockResolvedValue({})
    await notifyOrderCreated({ organizationId: 'org', branchId: null, orderId: 'o1', online: true, orderNumber: 'A12', customerName: 'Ana', total: 150000 })
    expect(mocks.dispatch.mock.calls[0][0]).toMatchObject({ type: 'NEW_ONLINE_ORDER', resourceId: 'o1', excludeUserIds: [] })

    mocks.dispatch.mockClear()
    await notifyRepairCreated({ organizationId: 'org', branchId: 'b1', repairId: 'r1', actorUserId: 'recepcion', device: 'Samsung A54', technicianId: 'tec' })
    expect(mocks.dispatch.mock.calls.map(([event]) => [event.type, event.excludeUserIds ?? event.targetUserIds])).toEqual([
      ['REPAIR_CREATED', ['recepcion', 'tec']],
      ['REPAIR_ASSIGNED', ['tec']],
    ])
  })

  it('el texto de la notificación dice qué entró', () => {
    expect(formatNotificationContent('NEW_ONLINE_ORDER', { orderNumber: 'A12', customerName: 'Ana', totalFormatted: 'Gs. 150.000' }).body).toBe('Pedido #A12 de Ana · Gs. 150.000')
    expect(formatNotificationContent('REPAIR_CREATED', { device: 'Samsung A54' }).body).toBe('Ingresó Samsung A54 al taller.')
  })

  it('las rutas que crean ventas, pedidos y reparaciones disparan el aviso después de responder', () => {
    expect(read('src/app/api/pos/process-sale/route.ts')).toMatch(/after\(\(\) => notifySaleCreated/)
    expect(read('src/app/api/orders/route.ts')).toMatch(/after\(\(\) => notifyOrderCreated/)
    expect(read('src/app/api/public/orders/route.ts')).toMatch(/after\(\(\) => notifyOrderCreated/)
    expect(read('src/app/api/repairs/route.ts')).toMatch(/after\(\(\) => notifyRepairCreated/)
  })

  it('un reintento con la misma clave no vuelve a mandar push', () => {
    const dispatcher = read('src/lib/notifications/server/dispatcher.ts')
    expect(dispatcher).toContain('duplicateUserIds.add(recipient.userId)')
    expect(dispatcher).toContain('.filter((m) => !duplicateUserIds.has(m.userId))')
  })

  it('Android usa el ícono monocromo para las notificaciones', () => {
    expect(read('mobile/app.json')).toContain('"icon": "./assets/images/android-icon-monochrome.png"')
  })
})
