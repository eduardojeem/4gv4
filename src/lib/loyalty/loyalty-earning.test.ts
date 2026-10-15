import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { awardPosSaleLoyaltyPoints, pointsBaseForPosSale } from './pos-sale-points'
import { awardPaidOrderLoyaltyPoints } from './order-points'
import { awardCreditInstallmentLoyaltyPoints } from './credit-points'
import { balancesFromAccounts, withRealLoyaltyPoints } from './customer-balances'
import { pointsPreviewText, rulesFromRows, settingsFromRow } from '@/app/dashboard/pos/hooks/useLoyaltyPreview'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/** Simula `award_loyalty_points_for_sale`: 1 punto cada 1.000 y una sola vez por clave. */
function clienteFalso() {
  const keys = new Set<string>()
  const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
    const key = String(args.p_idempotency_key)
    const points = Math.floor(Number(args.p_amount) / 1000)
    if (keys.has(key)) return { data: { points }, error: null }
    keys.add(key)
    return { data: points > 0 ? { points } : null, error: null }
  })
  return { rpc, keys }
}

describe('qué parte de una venta del POS suma puntos', () => {
  it('lo pagado ahora, no la parte financiada', () => {
    expect(pointsBaseForPosSale({ total: 500000, payments: [{ payment_method: 'cash', amount: 100000 }, { payment_method: 'credit', amount: 400000 }] })).toBe(100000)
  })

  it('sin el saldo a favor y nunca más que el total', () => {
    expect(pointsBaseForPosSale({ total: 100000, payments: [{ payment_method: 'cash', amount: 150000 }], storeCreditAmount: 30000 })).toBe(70000)
  })

  it('una venta toda a crédito no suma ahora', () => {
    expect(pointsBaseForPosSale({ total: 300000, payments: [{ payment_method: 'credit', amount: 300000 }] })).toBe(0)
  })
})

describe('acreditar una venta del POS', () => {
  it('sin cliente no acredita', async () => {
    const { rpc } = clienteFalso()
    await expect(awardPosSaleLoyaltyPoints({ rpc }, { organizationId: 'o', customerId: null, saleId: 's', pointsBase: 50000 })).resolves.toEqual({ points: 0, errors: [] })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('la venta con su clave y cada reparación con la suya', async () => {
    const { rpc, keys } = clienteFalso()
    const result = await awardPosSaleLoyaltyPoints({ rpc }, {
      organizationId: 'o', customerId: 'c', saleId: 's1', pointsBase: 250000,
      repairs: [{ id: 'r1', amount: 150000 }],
    })
    expect([...keys]).toEqual(['repair:r1', 'sale:s1'])
    expect(rpc.mock.calls.map(([, args]) => args.p_amount)).toEqual([150000, 100000])
    expect(result.points).toBe(250)
  })

  it('la reparación entregada después desde su pantalla no vuelve a sumar', async () => {
    const { rpc, keys } = clienteFalso()
    await awardPosSaleLoyaltyPoints({ rpc }, { organizationId: 'o', customerId: 'c', saleId: 's1', pointsBase: 150000, repairs: [{ id: 'r1', amount: 150000 }] })
    // La pantalla de entrega usa la misma clave: la base devuelve el asiento anterior.
    await rpc('award_loyalty_points_for_sale', { p_idempotency_key: 'repair:r1', p_amount: 150000 })
    expect(keys.size).toBe(1)
  })
})

describe('pedidos de la tienda online', () => {
  const pedido = { organizationId: 'o', orderId: 'p1', customerId: 'c', total: 200000 }

  it('suman al quedar pagados, sin el saldo a favor', async () => {
    const { rpc } = clienteFalso()
    await expect(awardPaidOrderLoyaltyPoints({ rpc }, { ...pedido, paymentStatus: 'PAID', storeCreditApplied: 50000 })).resolves.toEqual({ points: 150, error: null })
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_amount: 150000, p_idempotency_key: 'order:p1' })
  })

  it('un cobro parcial no suma', async () => {
    const { rpc } = clienteFalso()
    await awardPaidOrderLoyaltyPoints({ rpc }, { ...pedido, paymentStatus: 'PARTIAL' })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('el saldo que ven el POS y la lista de clientes', () => {
  it('sale del historial de puntos, no de la columna vieja', () => {
    const balances = balancesFromAccounts({ data: [{ customer_id: 'a', balance: 320 }], error: null })
    expect(withRealLoyaltyPoints([{ id: 'a', loyalty_points: 0 }, { id: 'b', loyalty_points: 999 }], balances)).toEqual([
      { id: 'a', loyalty_points: 320 },
      { id: 'b', loyalty_points: 0 },
    ])
  })

  it('sin el módulo instalado deja lo que había', () => {
    const balances = balancesFromAccounts({ data: null, error: { code: '42P01', message: 'relation "loyalty_accounts" does not exist' } })
    expect(balances).toBeNull()
    expect(withRealLoyaltyPoints([{ id: 'b', loyalty_points: 5 }], balances)).toEqual([{ id: 'b', loyalty_points: 5 }])
  })
})

describe('el aviso antes de cobrar', () => {
  const settings = settingsFromRow({ enabled: true, currency_per_point: 1000, points_per_unit: 1, rounding: 'floor' })

  it('dice cuántos puntos suma, con la promoción vigente', () => {
    const rules = rulesFromRows([{ id: 'r', name: 'Doble puntos', kind: 'multiplier', multiplier: 2, starts_at: '2000-01-01', ends_at: '2999-01-01', is_active: true }])
    expect(pointsPreviewText({ settings, rules, pointsBase: 50000, onCredit: false })).toBe('Esta compra suma 100 puntos (incluye 50 por Doble puntos)')
  })

  it('a crédito avisa que suma al pagar las cuotas', () => {
    expect(pointsPreviewText({ settings, rules: [], pointsBase: 0, onCredit: true })).toBe('Suma puntos a medida que se paguen las cuotas')
  })

  it('con los puntos apagados no muestra nada', () => {
    expect(pointsPreviewText({ settings: settingsFromRow({ enabled: false }), rules: [], pointsBase: 50000, onCredit: false })).toBeNull()
  })
})

describe('dónde se acredita', () => {
  it('el POS acredita con la sesión del cajero y devuelve los puntos al comprobante', () => {
    const ruta = leer('src/app/api/pos/process-sale/route.ts')
    expect(ruta).toContain('awardPosSaleLoyaltyPoints(await createClient(), {')
    expect(ruta).toContain('loyaltyPoints,')
    expect(leer('src/app/dashboard/pos/hooks/usePOSSaleProcessor.ts')).toContain('loyaltyPoints: Number(saleResult?.data?.loyaltyPoints) || 0,')
  })

  it('el cobro de pedidos online acredita al quedar pagado', () => {
    expect(leer('src/app/api/orders/[id]/payment/route.ts')).toContain('awardPaidOrderLoyaltyPoints(supabase, {')
  })
})

describe('ventas a crédito: suman al cobrar cada cuota', () => {
  const clienteConCuota = (amountPaid: number, organizationId = 'o') => {
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({ data: { points: Math.floor(Number(args.p_amount) / 1000) }, error: null }))
    const from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { amount_paid: amountPaid, customer_credits: { customer_id: 'c', organization_id: organizationId } }, error: null }) }) }) })
    return { rpc, from }
  }

  it('acredita lo cobrado, con una clave por pago parcial', async () => {
    const client = clienteConCuota(60000)
    await expect(awardCreditInstallmentLoyaltyPoints(client, { organizationId: 'o', installmentId: 'q1', paidAmount: 60000 })).resolves.toEqual({ points: 60, error: null })
    expect(client.rpc.mock.calls[0][1]).toMatchObject({ p_customer_id: 'c', p_amount: 60000, p_idempotency_key: 'credit-installment:q1:60000' })
  })

  it('no acredita cuotas de otra organización', async () => {
    const client = clienteConCuota(60000, 'otra')
    await awardCreditInstallmentLoyaltyPoints(client, { organizationId: 'o', installmentId: 'q1', paidAmount: 60000 })
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('se acredita en el cobro de cuotas, en el cobro por cliente y en la primera cuota del POS', () => {
    for (const route of ['src/app/api/credits/route.ts', 'src/app/api/customers/[id]/collect-payment/route.ts']) {
      const source = leer(route)
      expect(source).toMatch(/await awardCreditInstallmentLoyaltyPoints\(/)
      expect(source).toMatch(/paymentId:\s*\w+\.paymentId/)
    }
    expect(leer('src/app/api/pos/process-sale/route.ts')).toContain(".eq('installment_number', 1)")
  })
})

describe('devoluciones', () => {
  it('postventa descuenta los puntos de la compra al reintegrar, una vez por caso', () => {
    const ruta = leer('src/app/api/after-sales/[id]/route.ts')
    expect(ruta).toContain("supabase.rpc('reverse_loyalty_points_for_refund', {")
    expect(ruta).toContain('p_idempotency_key: `refund:${id}`,')
  })
})
