import { describe, expect, it } from 'vitest'
import { resolveInstallmentStatus } from './display'

describe('vencimiento por día de negocio', () => {
  it('mantiene pendiente hasta terminar el día de vencimiento', () => {
    expect(resolveInstallmentStatus({ status: 'pending', due_date: '2026-09-01T03:00:00Z' }, new Date('2026-09-02T02:59:59Z'))).toBe('pending')
  })
  it('considera vencida desde el día siguiente', () => {
    expect(resolveInstallmentStatus({ status: 'pending', due_date: '2026-09-01T03:00:00Z' }, new Date('2026-09-02T03:00:00Z'))).toBe('overdue')
  })
})
