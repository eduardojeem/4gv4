import { describe, expect, it } from 'vitest'
import { createCustomerFilePdf, type CustomerFileInput } from './customer-file-pdf'

const base: CustomerFileInput = {
  company: { name: 'Mi Comercio', ruc: '80000000-1' },
  customer: { name: 'Juan Pérez', code: 'CLI-001', phone: '0981000000' },
  situation: { creditLimit: 1_000_000, totalDebt: 300_000, overdueDebt: 0, availableCredit: 700_000 },
  statement: {
    totalDebt: 300_000,
    totalPaid: 200_000,
    credits: [{
      id: '11111111-2222-3333-4444-555555555555',
      creditCode: 'CR-0001',
      principal: 500_000,
      interestRate: 0,
      termMonths: 2,
      startDate: '2026-01-10',
      status: 'active',
      totalPaid: 200_000,
      remainingBalance: 300_000,
      installments: [
        { number: 1, dueDate: '2026-02-10', amount: 250_000, amountPaid: 200_000, status: 'partial' },
        { number: 2, dueDate: '2026-03-10', amount: 250_000, amountPaid: 0, status: 'pending' },
      ],
    }],
  },
  debts: [{ title: 'Cuota 1', detail: 'CR-0001', dueDate: '2026-02-10', pending: 50_000, total: 250_000 }],
  payments: [{ createdAt: '2026-02-01T12:00:00Z', amount: 200_000, method: 'Efectivo', creditCode: 'CR-0001', installmentNumber: 1 }],
}

const textOf = (doc: Awaited<ReturnType<typeof createCustomerFilePdf>>) => doc.output() as string

describe('createCustomerFilePdf', () => {
  it('usa el nombre del comercio, no una marca fija', async () => {
    const text = textOf(await createCustomerFilePdf(base))
    expect(text).toContain('Mi Comercio')
    expect(text).not.toContain('4G')
    expect(text).toContain('FICHA DEL CLIENTE')
    expect(text).toContain('CR-0001')
  })

  it('pagina y numera cuando hay muchos pagos', async () => {
    const payments = Array.from({ length: 120 }, (_, i) => ({ ...base.payments[0], amount: 1000 + i }))
    const doc = await createCustomerFilePdf({ ...base, payments })
    const pages = doc.getNumberOfPages()
    expect(pages).toBeGreaterThan(1)
    expect(textOf(doc)).toContain(`Página ${pages} de ${pages}`)
  })

  it('se arma sin créditos ni pagos', async () => {
    const doc = await createCustomerFilePdf({ ...base, statement: { credits: [], totalDebt: 0, totalPaid: 0 }, payments: [], debts: [] })
    expect(textOf(doc)).toContain('No tiene cr')
  })
})
