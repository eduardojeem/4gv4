import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  repairs: [] as Array<Record<string, unknown>>,
}))
vi.mock('@/lib/notifications/server/dispatcher', () => ({ dispatchNotificationEvent: mocks.dispatch }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ in: async () => ({ data: mocks.repairs, error: null }) }),
      }),
    }),
  }),
}))

import { notifyRepairReady, notifyRepairsDelivered, repairDeviceLabel } from '@/lib/notifications/server/business-events'
import { formatNotificationContent } from '@/lib/notifications/server/content'
import { NOTIFICATION_METADATA, NOTIFICATION_TYPES } from '@/lib/notifications/types'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

afterEach(() => {
  vi.clearAllMocks()
  mocks.repairs = []
})

describe('aviso de reparación lista', () => {
  it('avisa con el equipo y quién la cambió (el dispatcher no le avisa a sí mismo)', async () => {
    mocks.dispatch.mockResolvedValue({})
    await notifyRepairReady({ organizationId: 'org', branchId: 'b1', repairId: 'r1', actorUserId: 'tec', device: 'iPhone 13' })
    expect(mocks.dispatch).toHaveBeenCalledTimes(1)
    expect(mocks.dispatch.mock.calls[0][0]).toMatchObject({ type: 'REPAIR_READY', resourceId: 'r1', branchId: 'b1', actorUserId: 'tec', data: { device: 'iPhone 13' } })
  })

  it('el texto dice qué equipo está listo', () => {
    expect(formatNotificationContent('REPAIR_READY', { device: 'iPhone 13' }).body).toBe('iPhone 13 está listo para entregar.')
    expect(formatNotificationContent('REPAIR_READY', {}).body).toBe('Un equipo en el taller está listo para ser entregado.')
  })

  it('la ruta de estado lo dispara solo al pasar a «listo», después de responder', () => {
    const route = read('src/app/api/repairs/[id]/status/route.ts')
    expect(route).toMatch(/if \(stage === 'listo'\) \{[\s\S]*afterResponse\(\(\) => notifyRepairReady\(/)
  })
})

describe('aviso de reparación entregada', () => {
  it('es un tipo nuevo con push, para la sucursal', () => {
    expect(NOTIFICATION_TYPES).toContain('REPAIR_DELIVERED')
    expect(NOTIFICATION_METADATA.REPAIR_DELIVERED).toMatchObject({ category: 'repairs', target: 'branch_members', defaultPush: true, requiredModule: 'repairs' })
  })

  it('avisa una vez por reparación entregada, con el equipo y el resultado', async () => {
    mocks.dispatch.mockResolvedValue({})
    mocks.repairs = [
      { id: 'r1', device_brand: 'Samsung', device_model: 'A54', delivery_outcome: 'repaired', status: 'entregado' },
      { id: 'r2', device_brand: 'Motorola', device_model: null, delivery_outcome: 'withdrawn', status: 'entregado' },
      { id: 'r3', device_brand: 'Xiaomi', device_model: 'Note 12', delivery_outcome: null, status: 'listo' },
    ]
    await notifyRepairsDelivered({ organizationId: 'org', branchId: 'b1', repairIds: ['r1', 'r2', 'r3'], actorUserId: 'caja' })
    expect(mocks.dispatch.mock.calls.map(([event]) => [event.type, event.resourceId, event.data])).toEqual([
      ['REPAIR_DELIVERED', 'r1', { device: 'Samsung A54', outcome: 'repaired' }],
      ['REPAIR_DELIVERED', 'r2', { device: 'Motorola', outcome: 'withdrawn' }],
    ])
  })

  it('sin reparaciones no consulta ni avisa', async () => {
    await notifyRepairsDelivered({ organizationId: 'org', branchId: null, repairIds: [], actorUserId: 'u' })
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })

  it('el texto distingue reparada, retirada sin reparar y sin solución', () => {
    expect(formatNotificationContent('REPAIR_DELIVERED', { device: 'Samsung A54', outcome: 'repaired' }).body).toBe('Se entregó Samsung A54 al cliente.')
    expect(formatNotificationContent('REPAIR_DELIVERED', { device: 'Motorola', outcome: 'withdrawn' }).body).toBe('Se retiró Motorola sin reparar.')
    expect(formatNotificationContent('REPAIR_DELIVERED', { outcome: 'unrepairable' }).body).toBe('Se entregó un equipo sin solución.')
  })

  it('se dispara al entregar desde Reparaciones (reparada o no) y al cobrar en el POS marcando entregada', () => {
    const delivery = read('src/app/api/repairs/[id]/delivery/route.ts')
    expect(delivery.match(/afterResponse\(\(\) => notifyRepairsDelivered\(/g)).toHaveLength(2)
    expect(delivery).not.toMatch(/notifyRepairsDelivered[\s\S]{0,200}idempotent: true/)
    const pos = read('src/app/api/pos/process-sale/route.ts')
    expect(pos).toContain('if (body.p_mark_repairs_delivered === true && repairIds.length > 0) {')
  })

  it('arma el nombre del equipo sin espacios de más', () => {
    expect(repairDeviceLabel({ device_brand: ' Apple ', device_model: 'iPhone 13 ' })).toBe('Apple iPhone 13')
    expect(repairDeviceLabel({ device_brand: '', device_model: null })).toBeNull()
  })
})
