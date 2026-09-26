import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG = '11111111-1111-4111-8111-111111111111'
const BRANCH = '22222222-2222-4222-8222-222222222222'
const CUSTOMER = '44444444-4444-4444-8444-444444444444'
const REPAIR = '55555555-5555-4555-8555-555555555555'
const INSTALLMENT = '66666666-6666-4666-8666-666666666666'
const KEY = 'cobro-1234567890'

const estado = vi.hoisted(() => ({
  clienteDeLaEmpresa: true,
  deudas: [] as unknown[],
  cajaAbierta: true as boolean,
  sucursalError: null as string | null,
  rpcCuota: { error: null as null | { message: string }, applied: null as number | null },
  reparacionFalla: null as string | null,
  saldoFalla: false,
  cajaFalla: false,
  escriturasDirectas: [] as string[],
  saldos: [] as unknown[],
  movimientosCaja: [] as unknown[],
  saldosBorrados: [] as unknown[],
  rpcs: [] as Array<{ name: string; args: Record<string, unknown> }>,
  cobrosReparacion: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_o: unknown, handler: (req: unknown, ctx: unknown, route: unknown) => unknown) =>
    (request: unknown, route: unknown) => handler(request, {
      organization: { id: ORG, role: 'owner' },
      user: { id: 'user-1', role: 'admin' },
    }, route),
}))

vi.mock('@/lib/branches/server', () => ({
  getRequestedBranchId: () => BRANCH,
  resolveBranchScopeForUser: async (params: { strict?: boolean }) => {
    if (estado.sucursalError && params.strict) throw new Error(estado.sucursalError)
    return { branchId: BRANCH }
  },
}))

vi.mock('@/lib/customers/collect-payment', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/customers/collect-payment')>()
  return { ...real, loadCustomerDebts: async () => ({ debts: estado.deudas, error: null }) }
})

vi.mock('@/lib/credits/store-credit-balance', () => ({
  readStoreCreditBalance: async () => ({ available: 0, ledger: 0, reserved: 0 }),
}))

vi.mock('@/lib/repairs/financial-closure-rpc', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/repairs/financial-closure-rpc')>()
  return {
    ...real,
    closeRepairAndRegisterPayment: async (_client: unknown, input: Record<string, unknown>) => {
      estado.cobrosReparacion.push(input)
      if (estado.reparacionFalla) throw new real.FinancialClosureRpcError(estado.reparacionFalla, 'REPAIR_PAYMENT_INVALID_STATE', 422)
      const payment = input.payment as { amount: number }
      return { balance: 300 - payment.amount }
    },
  }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (tabla: string) => {
      if (tabla === 'customers') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({
            data: estado.clienteDeLaEmpresa ? { id: CUSTOMER, name: 'Ana', credit_limit: 0 } : null,
            error: null,
          }) }) }) }),
        }
      }
      if (tabla === 'customer_store_credits') {
        return {
          insert: (row: unknown) => ({
            select: () => ({ single: async () => {
              if (estado.saldoFalla) return { data: null, error: { message: 'caída' } }
              estado.saldos.push(row)
              return { data: { id: 'saldo-1' }, error: null }
            } }),
          }),
          delete: () => ({ eq: (_c: string, id: unknown) => ({ eq: async () => { estado.saldosBorrados.push(id); return { error: null } } }) }),
        }
      }
      if (tabla === 'cash_movements') {
        return {
          insert: async (row: unknown) => {
            if (estado.cajaFalla) return { error: { message: 'caída' } }
            estado.movimientosCaja.push(row)
            return { error: null }
          },
        }
      }
      estado.escriturasDirectas.push(tabla)
      return { update: () => ({ eq: async () => ({ error: null }) }), insert: async () => ({ error: null }) }
    },
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (tabla: string) => {
      if (tabla !== 'cash_closures') {
        estado.escriturasDirectas.push(tabla)
        return { update: () => ({ eq: async () => ({ error: null }) }) }
      }
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        order: async () => ({ data: estado.cajaAbierta ? [{ id: 'caja-1', register_id: 'principal' }] : [], error: null }),
      }
      return builder
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      estado.rpcs.push({ name, args })
      if (estado.rpcCuota.error) return { data: null, error: estado.rpcCuota.error }
      return { data: { applied_amount: estado.rpcCuota.applied ?? args.p_amount }, error: null }
    },
  }),
}))

import { POST } from '@/app/api/customers/[id]/collect-payment/route'

const deuda = (extra: Record<string, unknown>) => ({
  id: INSTALLMENT, type: 'installment', title: 'Cuota 1', totalAmount: 100000, paidAmount: 0,
  pendingAmount: 100000, isOverdue: true, status: 'Vencida', collectable: true, creditId: 'cr1', ...extra,
})

const cobrar = async (body: Record<string, unknown>) => {
  const request = new NextRequest(`http://localhost/api/customers/${CUSTOMER}/collect-payment`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod: 'cash', idempotencyKey: KEY, ...body }),
    headers: { 'Content-Type': 'application/json' },
  })
  const response = await (POST as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(
    request,
    { params: Promise.resolve({ id: CUSTOMER }) },
  )
  return { status: response.status, body: await response.json() }
}

beforeEach(() => {
  Object.assign(estado, {
    clienteDeLaEmpresa: true,
    deudas: [deuda({})],
    cajaAbierta: true,
    sucursalError: null,
    rpcCuota: { error: null, applied: null },
    reparacionFalla: null,
    saldoFalla: false,
    cajaFalla: false,
    escriturasDirectas: [],
    saldos: [],
    movimientosCaja: [],
    saldosBorrados: [],
    rpcs: [],
    cobrosReparacion: [],
  })
})

describe('cobrar a un cliente', () => {
  /**
   * El POST no verificaba la organización: con un ID de otra empresa se le
   * podían marcar cuotas como pagadas usando el cliente de servicio.
   */
  it('un cliente de otra empresa no se toca', async () => {
    estado.clienteDeLaEmpresa = false
    const { status, body } = await cobrar({ amount: 100000 })

    expect(status).toBe(404)
    expect(body.error).toBe('El cliente no pertenece a la organización activa.')
    expect(estado.rpcs).toHaveLength(0)
    expect(estado.cobrosReparacion).toHaveLength(0)
  })

  it('no se puede cobrar en una sucursal a la que no se tiene acceso', async () => {
    estado.sucursalError = 'No autorizado para operar sobre la sucursal seleccionada.'
    const { status } = await cobrar({ amount: 100000 })
    expect(status).toBe(403)
    expect(estado.rpcs).toHaveLength(0)
  })

  /** Antes escribía paid_amount y amount_paid a mano, sin bloquear la fila. */
  it('cada deuda se cobra por su camino atómico, nunca escribiendo a mano', async () => {
    estado.deudas = [
      deuda({ id: REPAIR, type: 'repair', title: 'Reparación #T-1', pendingAmount: 200000 }),
      deuda({ pendingAmount: 100000, isOverdue: false }),
    ]
    const { status, body } = await cobrar({ amount: 300000 })

    expect(status).toBe(200)
    expect(estado.escriturasDirectas).toEqual([])

    expect(estado.cobrosReparacion).toHaveLength(1)
    expect(estado.cobrosReparacion[0]).toMatchObject({
      repairId: REPAIR,
      organizationId: ORG,
      branchId: BRANCH,
      cashSessionId: 'caja-1',
      deliver: false,
      payment: { method: 'cash', amount: 200000, idempotencyKey: `${KEY}:repair:${REPAIR}` },
    })

    expect(estado.rpcs).toEqual([{
      name: 'register_credit_payment_atomic',
      args: expect.objectContaining({ p_organization_id: ORG, p_branch_id: BRANCH, p_installment_id: INSTALLMENT, p_amount: 100000, p_method: 'cash' }),
    }])
    expect(body.appliedAllocations).toHaveLength(2)
    expect(body.receiptNumber).toMatch(/^REC-\d{8}-[0-9A-F]{8}$/)
  })

  /** Un fallo a mitad de camino devolvía «Pago registrado» igual. */
  it('si una deuda falla se corta ahí y se informa lo que sí se cobró', async () => {
    estado.deudas = [
      deuda({ pendingAmount: 100000 }),
      deuda({ id: REPAIR, type: 'repair', title: 'Reparación #T-1', pendingAmount: 200000, isOverdue: false }),
    ]
    estado.reparacionFalla = 'No se puede procesar cobros en una reparación cancelada.'

    const { status, body } = await cobrar({ amount: 300000 })

    expect(status).toBe(207)
    expect(body.success).toBe(false)
    expect(body.partial).toBe(true)
    expect(body.totalApplied).toBe(100000)
    expect(body.error).toContain('Reparación #T-1')
    expect(estado.saldos).toHaveLength(0)
  })

  it('si falla la primera no se registra nada', async () => {
    estado.rpcCuota.error = { message: 'Open cash session required for cash payment' }
    const { status, body } = await cobrar({ amount: 100000 })
    expect(status).toBe(422)
    expect(body.partial).toBe(false)
  })

  it('en efectivo exige caja abierta', async () => {
    estado.cajaAbierta = false
    const { status, body } = await cobrar({ amount: 100000 })
    expect(status).toBe(409)
    expect(body.code).toBe('CASH_REGISTER_NOT_OPEN')
    expect(estado.rpcs).toHaveLength(0)
  })

  it('una transferencia sin comprobante no se registra', async () => {
    const { status, body } = await cobrar({ amount: 100000, paymentMethod: 'transfer' })
    expect(status).toBe(400)
    expect(body.field).toBe('referenceNumber')
  })

  /** Un cero de más quedaba como saldo a favor sin que nadie lo notara. */
  it('un sobrante no se acredita sin confirmación', async () => {
    const { status, body } = await cobrar({ amount: 1000000 })
    expect(status).toBe(422)
    expect(body.code).toBe('EXCESS_REQUIRES_CONFIRMATION')
    expect(body.excess).toBe(900000)
    expect(estado.rpcs).toHaveLength(0)
  })

  /** Antes el sobrante se acreditaba y la plata no figuraba en ningún arqueo. */
  it('el sobrante confirmado en efectivo entra a saldo a favor y a la caja', async () => {
    const { status, body } = await cobrar({ amount: 150000, creditExcessToStoreCredit: true })

    expect(status).toBe(200)
    expect(body.excessToStoreCredit).toBe(50000)
    expect(estado.saldos).toEqual([expect.objectContaining({ customer_id: CUSTOMER, organization_id: ORG, amount: 50000 })])
    expect(estado.movimientosCaja).toEqual([expect.objectContaining({ session_id: 'caja-1', type: 'cash_in', amount: 50000, branch_id: BRANCH })])
  })

  it('si no se puede registrar en caja, el saldo a favor se revierte', async () => {
    estado.cajaFalla = true
    const { status, body } = await cobrar({ amount: 150000, creditExcessToStoreCredit: true })

    expect(status).toBe(200)
    expect(body.excessToStoreCredit).toBe(0)
    expect(estado.saldosBorrados).toEqual(['saldo-1'])
    expect(body.storeCreditWarning).toContain('no se pudo registrar en caja')
  })

  it('con tarjeta el sobrante va a saldo a favor sin movimiento de caja', async () => {
    const { body } = await cobrar({ amount: 150000, paymentMethod: 'card', voucherNumber: '0482', creditExcessToStoreCredit: true })
    expect(body.excessToStoreCredit).toBe(50000)
    expect(estado.movimientosCaja).toHaveLength(0)
  })

  /** Si alguien pagó la cuota mientras tanto, lo que no entró no desaparece callado. */
  it('lo que la cuota no aceptó se avisa', async () => {
    estado.rpcCuota.applied = 60000
    const { body } = await cobrar({ amount: 100000 })

    expect(body.appliedAllocations[0].allocatedAmount).toBe(60000)
    expect(body.storeCreditWarning).toContain('40.000')
  })

  it('las deudas de otra sucursal no se cobran', async () => {
    estado.deudas = [deuda({ id: REPAIR, type: 'repair', collectable: false })]
    const { status, body } = await cobrar({ amount: 100000 })
    expect(status).toBe(422)
    expect(body.code).toBe('NOTHING_TO_COLLECT')
    expect(estado.cobrosReparacion).toHaveLength(0)
  })
})
