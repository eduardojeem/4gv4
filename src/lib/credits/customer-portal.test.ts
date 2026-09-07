import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { calculateCustomerCreditOverview, getCustomerInstallmentView } from './customer-portal'

describe('customer credit portal calculations', () => {
  it('cuenta pagos parciales y calcula solamente el saldo restante', () => {
    const overview = calculateCustomerCreditOverview([{
      id: 'c1', principal: 250_000, term_months: 2, start_date: '2026-08-01', status: 'active',
      installments: [
        { id: 'i1', installment_number: 1, due_date: '2026-08-10', amount: 150_000, amount_paid: 50_000, status: 'pending' },
        { id: 'i2', installment_number: 2, due_date: '2026-10-10', amount: 150_000, amount_paid: 0, status: 'pending' },
      ],
    }], new Date('2026-09-06T12:00:00Z'))

    expect(overview.totalFinanced).toBe(300_000)
    expect(overview.totalPaid).toBe(50_000)
    expect(overview.totalPending).toBe(250_000)
    expect(overview.overdueAmount).toBe(100_000)
    expect(overview.nextPaymentAmount).toBe(100_000)
  })

  it('marca vencida una cuota pendiente cuando su fecha ya paso', () => {
    expect(getCustomerInstallmentView({
      id: 'i1', installment_number: 1, due_date: '2026-08-10', amount: 100_000, amount_paid: 20_000, status: 'pending',
    }, new Date('2026-09-06T12:00:00Z'))).toMatchObject({ status: 'late', remaining: 80_000 })
  })
})

describe('customer credit portal security boundary', () => {
  it('resuelve la tienda y limita clientes y creditos a esa organizacion', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/credits/customer-portal.server.ts'), 'utf8')
    expect(source).toContain('resolvePublicOrganizationBySlug(organizationSlug, admin)')
    expect(source).toContain(".eq('profile_id', userId)")
    expect(source.match(/\.eq\('organization_id', organization\.id\)/g)).toHaveLength(2)
  })
})
