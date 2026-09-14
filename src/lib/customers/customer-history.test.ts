import { describe, expect, it } from 'vitest'
import { buildCustomerHistory } from './customer-history'

const NOW = new Date('2026-09-13T12:00:00Z')

const history = (sources: Partial<Parameters<typeof buildCustomerHistory>[0]>) =>
  buildCustomerHistory({ sales: [], repairs: [], credits: [], installments: [], now: NOW, ...sources })

const repair = (overrides: Record<string, unknown>) => ({
  id: 'rep-1',
  ticket_number: 'R-100',
  device_brand: 'Samsung',
  device_model: 'A54',
  problem_description: 'Pantalla rota',
  status: 'entregado',
  pricing_mode: 'budget',
  final_cost: 750000,
  estimated_cost: 750000,
  paid_amount: 0,
  created_at: '2026-08-01T10:00:00Z',
  parts: [],
  ...overrides,
})

const sale = (overrides: Record<string, unknown>) => ({
  id: 'sale-1',
  code: 'SALE-1',
  status: 'completed',
  payment_method: 'efectivo',
  payment_status: 'completed',
  total_amount: 120000,
  created_at: '2026-08-02T10:00:00Z',
  sale_items: [{ quantity: 2, product: { name: 'Funda' } }],
  ...overrides,
})

describe('historial del cliente: estado de pago', () => {
  /** Toda venta salía «Pendiente» porque se leía un campo que no venía. */
  it('una venta cobrada sale pagada, sin saldo', () => {
    const [item] = history({ sales: [sale({})] }).items
    expect(item).toMatchObject({ kind: 'sale', payment: 'paid', balance: 0, paid: 120000, detail: 'Funda' })
  })

  it('una venta anulada se marca como tal y no deja deuda', () => {
    const { items, summary } = history({ sales: [sale({ status: 'cancelled' })] })
    expect(items[0].payment).toBe('cancelled')
    expect(summary.owed).toBe(0)
  })

  it('una venta a crédito muestra lo que falta de sus cuotas', () => {
    const { items, summary } = history({
      sales: [sale({ payment_method: 'credit', total_amount: 300000 })],
      credits: [{ id: 'cr-1', sale_id: 'sale-1', status: 'active' }],
      installments: [
        { id: 'i1', credit_id: 'cr-1', amount: 100000, amount_paid: 100000, status: 'paid', due_date: '2026-08-01' },
        { id: 'i2', credit_id: 'cr-1', amount: 100000, amount_paid: 40000, status: 'pending', due_date: '2026-09-01' },
        { id: 'i3', credit_id: 'cr-1', amount: 100000, amount_paid: 0, status: 'pending', due_date: '2026-10-01' },
      ],
    })
    expect(items[0]).toMatchObject({ payment: 'credit', balance: 160000, paid: 140000, overdue: true, nextDueDate: '2026-09-01' })
    expect(summary).toMatchObject({ owed: 160000, overdueCount: 1, withBalance: 1 })
  })

  /** Las ventas sumadas a una cuenta corriente nombran la venta en la cuota, no en el crédito. */
  it('reconoce las cuotas que nombran la venta aunque el crédito sea de otra', () => {
    const [item] = history({
      sales: [sale({ payment_method: 'credit', total_amount: 70000 })],
      credits: [{ id: 'cr-cc', sale_id: null, status: 'active' }],
      installments: [{ id: 'i1', credit_id: 'cr-cc', sale_id: 'sale-1', amount: 70000, amount_paid: 70000, status: 'paid' }],
    }).items
    expect(item).toMatchObject({ payment: 'credit_settled', balance: 0 })
  })

  /** Caso real: una venta de 2.000.000 financiada debía 3.480.000 con intereses. */
  it('con intereses, lo pagado se cuenta contra el total financiado', () => {
    const [item] = history({
      sales: [sale({ payment_method: 'credit', total_amount: 200000 })],
      credits: [{ id: 'cr-1', sale_id: 'sale-1', status: 'active' }],
      installments: [
        { id: 'i1', credit_id: 'cr-1', amount: 120000, amount_paid: 120000, status: 'paid' },
        { id: 'i2', credit_id: 'cr-1', amount: 120000, amount_paid: 0, status: 'pending' },
      ],
    }).items
    expect(item).toMatchObject({ total: 200000, financedTotal: 240000, paid: 120000, balance: 120000 })
  })

  it('a crédito sin cuotas propias no inventa un saldo', () => {
    const [item] = history({ sales: [sale({ payment_method: 'credit' })] }).items
    expect(item).toMatchObject({ payment: 'credit', balance: null })
  })

  /** Caso real: entregada a crédito, `paid_amount` igual al total y 300.000 por cobrar. */
  it('una reparación financiada con cuotas impagas no sale pagada', () => {
    const { items, summary } = history({
      repairs: [repair({ paid_amount: 750000 })],
      credits: [{ id: 'cr-r', status: 'active', metadata: { repair_id: 'rep-1' } }],
      installments: [
        { id: 'i1', credit_id: 'cr-r', amount: 450000, amount_paid: 450000, status: 'paid', due_date: '2026-08-10' },
        { id: 'i2', credit_id: 'cr-r', amount: 300000, amount_paid: 0, status: 'pending', due_date: '2026-10-10' },
      ],
    })
    expect(items[0]).toMatchObject({ payment: 'credit', balance: 300000, paid: 450000, overdue: false })
    expect(summary.owed).toBe(300000)
  })

  it('una reparación financiada y saldada figura como crédito saldado', () => {
    const [item] = history({
      repairs: [repair({ paid_amount: 100000, final_cost: 100000 })],
      credits: [{ id: 'cr-r', status: 'completed', metadata: { repair_id: 'rep-1' } }],
      installments: [{ id: 'i1', credit_id: 'cr-r', amount: 100000, amount_paid: 100000, status: 'paid' }],
    }).items
    expect(item).toMatchObject({ payment: 'credit_settled', balance: 0 })
  })

  it('retirada con adelanto: pago parcial, deuda vencida', () => {
    const { items, summary } = history({ repairs: [repair({ paid_amount: 250000 })] })
    expect(items[0]).toMatchObject({ payment: 'partial', paid: 250000, balance: 500000, overdue: true })
    expect(summary).toMatchObject({ owed: 500000, dueOnPickup: 0 })
  })

  it('en el taller sin pagar: se cobra al retirar, todavía no es deuda', () => {
    const { items, summary } = history({ repairs: [repair({ status: 'listo', delivered_at: null })] })
    expect(items[0]).toMatchObject({ payment: 'unpaid', balance: 750000, overdue: false, delivered: false })
    expect(summary).toMatchObject({ owed: 0, dueOnPickup: 750000, repairsInShop: 1 })
  })

  /** El saldo sale de la cuenta del cobro: repuestos y descuento incluidos. */
  it('usa el mismo total que el cobro de la reparación', () => {
    const [item] = history({
      repairs: [repair({
        pricing_mode: 'automatic',
        labor_cost: 200000,
        final_cost: null,
        estimated_cost: 150000,
        paid_amount: 150000,
        parts: [{ unit_price: 100000, unit_cost: 60000, quantity: 2 }],
      })],
    }).items
    expect(item).toMatchObject({ total: 400000, paid: 150000, balance: 250000, payment: 'partial' })
  })

  /** Caso real: precio solo en `final_cost`, cobrado entero, y el cálculo daba 0. */
  it('una reparación vieja cobrada no figura sin cargo', () => {
    const [item] = history({
      repairs: [repair({ pricing_mode: 'automatic', labor_cost: 0, final_cost: null, estimated_cost: 450000, paid_amount: 450000 })],
    }).items
    expect(item).toMatchObject({ payment: 'paid', total: 450000, balance: 0 })
  })

  it('sin presupuesto no se muestra como deuda ni como pagada', () => {
    const [item] = history({
      repairs: [repair({ status: 'recibido', pricing_mode: null, final_cost: null, estimated_cost: 0, paid_amount: 0 })],
    }).items
    expect(item.payment).toBe('no_charge')
  })

  it('una reparación cancelada no deja saldo', () => {
    const { items, summary } = history({ repairs: [repair({ status: 'cancelado' })] })
    expect(items[0]).toMatchObject({ payment: 'cancelled', balance: 0 })
    expect(summary).toMatchObject({ owed: 0, repairsInShop: 0 })
  })

  it('ignora las cuotas de créditos cancelados', () => {
    const [item] = history({
      repairs: [repair({ paid_amount: 750000 })],
      credits: [{ id: 'cr-x', status: 'cancelled', metadata: { repair_id: 'rep-1' } }],
      installments: [{ id: 'i1', credit_id: 'cr-x', amount: 750000, amount_paid: 0, status: 'pending' }],
    }).items
    expect(item).toMatchObject({ payment: 'paid', balance: 0 })
  })

  it('ordena de lo más reciente a lo más antiguo, mezclando ventas y reparaciones', () => {
    const { items, summary } = history({
      sales: [sale({ created_at: '2026-08-02T10:00:00Z' })],
      repairs: [repair({ created_at: '2026-09-01T10:00:00Z', paid_amount: 750000 })],
    })
    expect(items.map((i) => i.kind)).toEqual(['repair', 'sale'])
    expect(summary).toMatchObject({ salesCount: 1, repairsCount: 1 })
  })
})
