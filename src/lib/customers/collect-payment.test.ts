import { describe, expect, it } from 'vitest'
import {
  buildReceiptNumber,
  collectPaymentRequestSchema,
  loadCustomerDebts,
  paymentNote,
  paymentReference,
  planAllocations,
  type DebtItem,
} from './collect-payment'

const ORG = '11111111-1111-4111-8111-111111111111'
const BRANCH = '22222222-2222-4222-8222-222222222222'
const OTHER_BRANCH = '33333333-3333-4333-8333-333333333333'
const KEY = 'cobro-1234567890'

const deuda = (extra: Partial<DebtItem>): DebtItem => ({
  id: 'd',
  type: 'installment',
  title: 'Deuda',
  totalAmount: 100,
  paidAmount: 0,
  pendingAmount: 100,
  isOverdue: false,
  status: 'Pendiente',
  collectable: true,
  ...extra,
})

describe('el pedido de cobro', () => {
  const base = { amount: 50000, paymentMethod: 'cash', idempotencyKey: KEY }

  it('acepta un cobro en efectivo simple', () => {
    const r = collectPaymentRequestSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.mode).toBe('auto')
      expect(r.data.creditExcessToStoreCredit).toBe(false)
    }
  })

  /** Sin comprobante, una transferencia o un cobro con tarjeta no se concilia después. */
  it('exige el comprobante de la transferencia y el cupón de la tarjeta', () => {
    const transfer = collectPaymentRequestSchema.safeParse({ ...base, paymentMethod: 'transfer' })
    expect(transfer.success).toBe(false)
    if (!transfer.success) expect(transfer.error.issues[0].message).toBe('Ingresá el número de comprobante de la transferencia.')

    const card = collectPaymentRequestSchema.safeParse({ ...base, paymentMethod: 'card', referenceNumber: 'no sirve para tarjeta' })
    expect(card.success).toBe(false)

    expect(collectPaymentRequestSchema.safeParse({ ...base, paymentMethod: 'transfer', referenceNumber: '8945231' }).success).toBe(true)
    expect(collectPaymentRequestSchema.safeParse({ ...base, paymentMethod: 'card', voucherNumber: '0482' }).success).toBe(true)
  })

  it('rechaza montos imposibles y métodos inventados', () => {
    expect(collectPaymentRequestSchema.safeParse({ ...base, amount: 0 }).success).toBe(false)
    expect(collectPaymentRequestSchema.safeParse({ ...base, amount: 10.5 }).success).toBe(false)
    expect(collectPaymentRequestSchema.safeParse({ ...base, amount: 2_000_000_000 }).success).toBe(false)
    expect(collectPaymentRequestSchema.safeParse({ ...base, paymentMethod: 'bitcoin' }).success).toBe(false)
  })

  it('los últimos dígitos de la tarjeta son cuatro números', () => {
    const card = { ...base, paymentMethod: 'card', voucherNumber: '1' }
    expect(collectPaymentRequestSchema.safeParse({ ...card, lastFourDigits: '12' }).success).toBe(false)
    expect(collectPaymentRequestSchema.safeParse({ ...card, lastFourDigits: '4589' }).success).toBe(true)
    expect(collectPaymentRequestSchema.safeParse({ ...card, lastFourDigits: '' }).success).toBe(true)
  })

  it('pide una clave de idempotencia', () => {
    expect(collectPaymentRequestSchema.safeParse({ amount: 1, paymentMethod: 'cash' }).success).toBe(false)
  })

  it('el comprobante que se manda depende del método', () => {
    expect(paymentReference({ paymentMethod: 'transfer', referenceNumber: 'T1', voucherNumber: 'V1' })).toBe('T1')
    expect(paymentReference({ paymentMethod: 'card', referenceNumber: 'T1', voucherNumber: 'V1' })).toBe('V1')
    expect(paymentReference({ paymentMethod: 'cash', referenceNumber: 'T1', voucherNumber: 'V1' })).toBeNull()
    expect(paymentNote({ paymentMethod: 'card', cardType: 'credit', posNetwork: 'Bancard', lastFourDigits: '4589' }))
      .toBe('Tarjeta de crédito · Bancard · terminada en 4589')
  })
})

describe('el reparto del monto', () => {
  const vencida = deuda({ id: 'vencida', pendingAmount: 60, isOverdue: true, dueDate: '2026-08-01' })
  const nueva = deuda({ id: 'nueva', pendingAmount: 80, dueDate: '2026-09-20' })
  const vieja = deuda({ id: 'vieja', pendingAmount: 40, dueDate: '2026-09-01' })
  const otraSucursal = deuda({ id: 'otra', type: 'repair', pendingAmount: 500, isOverdue: true, collectable: false })

  it('en automático cubre primero lo vencido y después lo más antiguo', () => {
    const plan = planAllocations([nueva, vieja, vencida], { amount: 120, mode: 'auto' })
    expect(plan.allocations.map((a) => [a.debt.id, a.amount])).toEqual([['vencida', 60], ['vieja', 40], ['nueva', 20]])
    expect(plan.excess).toBe(0)
  })

  /** La plata tiene que entrar a la caja de la sucursal donde se recibe. */
  it('no toca deudas de otra sucursal aunque estén vencidas', () => {
    const plan = planAllocations([otraSucursal, nueva], { amount: 100, mode: 'auto' })
    expect(plan.allocations.map((a) => a.debt.id)).toEqual(['nueva'])
    expect(plan.excess).toBe(20)
  })

  it('en manual no pasa de lo pendiente ni de lo recibido', () => {
    const plan = planAllocations([vencida, nueva], {
      amount: 100,
      mode: 'manual',
      allocations: [{ id: 'vencida', amount: 999 }, { id: 'nueva', amount: 70 }, { id: 'otra', amount: 50 }],
    })
    expect(plan.allocations.map((a) => [a.debt.id, a.amount])).toEqual([['vencida', 60], ['nueva', 40]])
    expect(plan.excess).toBe(0)
  })

  it('lo que no se asigna queda como sobrante', () => {
    const plan = planAllocations([vencida], { amount: 100, mode: 'manual', allocations: [{ id: 'vencida', amount: 10 }] })
    expect(plan.allocations[0].amount).toBe(10)
    expect(plan.excess).toBe(90)
  })
})

/** Un cliente de base mínimo: responde a cada tabla con filas fijas. */
function baseFalsa(tablas: Record<string, { data?: unknown[]; error?: unknown }>) {
  const consultas: Array<{ tabla: string; filtros: Array<[string, unknown]> }> = []
  return {
    consultas,
    from(tabla: string) {
      const registro = { tabla, filtros: [] as Array<[string, unknown]> }
      consultas.push(registro)
      const respuesta = tablas[tabla] ?? { data: [] }
      const builder: any = {
        select: () => builder,
        eq: (col: string, val: unknown) => { registro.filtros.push([col, val]); return builder },
        in: (col: string, val: unknown) => { registro.filtros.push([col, val]); return builder },
        order: () => builder,
        then: (resolve: (v: unknown) => unknown) => resolve({ data: respuesta.data ?? [], error: respuesta.error ?? null }),
      }
      return builder
    },
  }
}

describe('las deudas del cliente', () => {
  const reparacion = (extra: Record<string, unknown>) => ({
    id: 'r1', ticket_number: 'T-1', status: 'listo', branch_id: BRANCH, pricing_mode: 'automatic',
    labor_cost: 0, final_cost: 300, estimated_cost: 300, discount_amount: 0, paid_amount: 100,
    payment_status: 'parcial', delivered_at: null, created_at: '2026-09-01', parts: [],
    ...extra,
  })

  it('no ofrece cobrar reparaciones canceladas', async () => {
    const db = baseFalsa({
      repairs: { data: [reparacion({ id: 'viva' }), reparacion({ id: 'cancelada', status: 'cancelado' })] },
      customer_credits: { data: [] },
    })
    const { debts } = await loadCustomerDebts(db, { organizationId: ORG, customerId: 'c1', branchId: BRANCH })
    expect(debts.map((d) => d.id)).toEqual(['viva'])
    expect(debts[0].pendingAmount).toBe(200)
  })

  it('las reparaciones de otra sucursal se ven pero no se cobran desde acá', async () => {
    const db = baseFalsa({
      repairs: { data: [reparacion({ id: 'aca' }), reparacion({ id: 'alla', branch_id: OTHER_BRANCH })] },
      customer_credits: { data: [] },
    })
    const { debts } = await loadCustomerDebts(db, { organizationId: ORG, customerId: 'c1', branchId: BRANCH })
    const alla = debts.find((d) => d.id === 'alla')!
    expect(alla.collectable).toBe(false)
    expect(alla.blockedReason).toContain('otra sucursal')
    expect(debts.find((d) => d.id === 'aca')!.collectable).toBe(true)
  })

  it('ni cuotas de créditos cancelados ni cuotas ya pagadas', async () => {
    const db = baseFalsa({
      repairs: { data: [] },
      customer_credits: { data: [{ id: 'vivo', status: 'active' }, { id: 'cancelado', status: 'cancelled' }, { id: 'sin-estado', status: null }] },
      credit_installments: {
        data: [
          { id: 'i1', credit_id: 'vivo', installment_number: 1, due_date: '2026-01-01', amount: 100, amount_paid: 0, status: 'pending' },
          { id: 'i2', credit_id: 'vivo', installment_number: 2, due_date: '2026-12-01', amount: 100, amount_paid: 100, status: 'paid' },
          { id: 'i3', credit_id: 'sin-estado', installment_number: 1, due_date: '2026-12-01', amount: 50, amount_paid: 20, status: 'pending' },
        ],
      },
    })
    const { debts } = await loadCustomerDebts(db, { organizationId: ORG, customerId: 'c1', branchId: BRANCH, now: new Date('2026-09-13') })

    expect(debts.map((d) => d.id)).toEqual(['i1', 'i3'])
    expect(debts[0].isOverdue).toBe(true)
    expect(debts[1].pendingAmount).toBe(30)
    // Solo se pidieron cuotas de los créditos que se pueden cobrar.
    const pedidoCuotas = db.consultas.find((c) => c.tabla === 'credit_installments')!
    expect(pedidoCuotas.filtros).toContainEqual(['credit_id', ['vivo', 'sin-estado']])
  })

  /** Antes los créditos se buscaban solo por cliente, sin mirar la empresa. */
  it('todo se acota a la organización', async () => {
    const db = baseFalsa({ repairs: { data: [] }, customer_credits: { data: [] } })
    await loadCustomerDebts(db, { organizationId: ORG, customerId: 'c1', branchId: BRANCH })
    for (const tabla of ['repairs', 'customer_credits']) {
      expect(db.consultas.find((c) => c.tabla === tabla)!.filtros).toContainEqual(['organization_id', ORG])
    }
  })

  it('si una lectura falla lo dice, en vez de devolver deudas incompletas', async () => {
    const db = baseFalsa({ repairs: { error: { message: 'caída' } } })
    const result = await loadCustomerDebts(db, { organizationId: ORG, customerId: 'c1', branchId: BRANCH })
    expect(result.error).toBe('No se pudieron leer las reparaciones del cliente.')
    expect(result.debts).toEqual([])
  })
})

describe('el número de recibo', () => {
  it('lleva la fecha y un tramo aleatorio', () => {
    const numero = buildReceiptNumber(new Date('2026-09-13T15:00:00Z'), () => 'abcdef12-3456-7890-abcd-ef1234567890')
    expect(numero).toBe('REC-20260913-ABCDEF12')
  })
})
