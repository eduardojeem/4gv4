import { describe, expect, it } from 'vitest'
import { repairRevenueDate } from '@/lib/finance/server'

describe('una reparación es ingreso cuando se entrega', () => {
  it('entregada: la fecha de entrega, no la de ingreso', () => {
    expect(repairRevenueDate({ status: 'entregado', createdAt: '2026-09-20T10:00:00Z', deliveredAt: '2026-10-05T15:00:00Z' })).toBe('2026-10-05T15:00:00Z')
  })

  it('todavía en el taller (o cancelada) no es ingreso', () => {
    for (const status of ['recibido', 'reparacion', 'listo', 'pausado', 'cancelado']) {
      expect(repairRevenueDate({ status, createdAt: '2026-10-01T10:00:00Z', deliveredAt: null })).toBeNull()
    }
  })

  it('entregadas viejas sin fecha de entrega usan la de ingreso', () => {
    expect(repairRevenueDate({ status: 'entregado', createdAt: '2026-08-04T10:00:00Z', deliveredAt: null })).toBe('2026-08-04T10:00:00Z')
  })
})
