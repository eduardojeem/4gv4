import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG = '11111111-1111-4111-8111-111111111111'
const CUSTOMER = '44444444-4444-4444-8444-444444444444'

const estado = vi.hoisted(() => ({
  clienteDeLaEmpresa: true,
  filtros: [] as Array<{ tabla: string; columna: string; valor: unknown }>,
  tablas: {} as Record<string, unknown[]>,
}))

vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_o: unknown, handler: (req: unknown, ctx: unknown, route: unknown) => unknown) =>
    (request: unknown, route: unknown) => handler(request, { organization: { id: ORG }, user: { id: 'u1' } }, route),
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

/** Un constructor de consultas falso que anota cada filtro y resuelve con la tabla. */
function consulta(tabla: string) {
  const builder: Record<string, unknown> = {}
  const anotar = (columna: string, valor: unknown) => {
    estado.filtros.push({ tabla, columna, valor })
    return builder
  }
  Object.assign(builder, {
    select: () => builder,
    eq: anotar,
    is: anotar,
    in: anotar,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: estado.clienteDeLaEmpresa ? { id: CUSTOMER } : null, error: null }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: estado.tablas[tabla] ?? [], error: null }),
  })
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({ from: (tabla: string) => consulta(tabla) }),
}))

import { GET } from '@/app/api/customers/[id]/history/route'

const pedir = async (id: string) => {
  const response = await (GET as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(
    new NextRequest(`http://localhost/api/customers/${id}/history`),
    { params: Promise.resolve({ id }) },
  )
  return { status: response.status, body: await response.json() }
}

beforeEach(() => {
  estado.clienteDeLaEmpresa = true
  estado.filtros = []
  estado.tablas = {}
})

describe('GET /api/customers/[id]/history', () => {
  it('rechaza un id que no es de cliente', async () => {
    expect((await pedir('abc')).status).toBe(400)
  })

  /** Usa el cliente de servicio: sin este control se leería el historial de otra empresa. */
  it('no muestra el historial de un cliente de otra empresa', async () => {
    estado.clienteDeLaEmpresa = false
    const { status, body } = await pedir(CUSTOMER)
    expect(status).toBe(404)
    expect(body.items).toBeUndefined()
  })

  it('acota ventas, reparaciones y créditos a la empresa activa', async () => {
    await pedir(CUSTOMER)
    for (const tabla of ['customers', 'sales', 'repairs', 'customer_credits']) {
      expect(estado.filtros).toContainEqual({ tabla, columna: 'organization_id', valor: ORG })
    }
    expect(estado.filtros).toContainEqual({ tabla: 'repairs', columna: 'deleted_at', valor: null })
  })

  it('devuelve cada operación con su estado de pago', async () => {
    estado.tablas = {
      sales: [{ id: 's1', code: 'V-1', status: 'completed', payment_method: 'efectivo', payment_status: 'completed', total_amount: 50000, created_at: '2026-09-01' }],
      repairs: [{ id: 'r1', ticket_number: 'R-1', status: 'entregado', pricing_mode: 'budget', final_cost: 750000, paid_amount: 750000, created_at: '2026-09-02', parts: [] }],
      customer_credits: [{ id: 'c1', status: 'active', metadata: { repair_id: 'r1' } }],
      credit_installments: [{ id: 'i1', credit_id: 'c1', amount: 750000, amount_paid: 450000, status: 'pending', due_date: '2099-01-01' }],
    }
    const { status, body } = await pedir(CUSTOMER)
    expect(status).toBe(200)
    expect(body.items.map((i: { kind: string; payment: string; balance: number }) => [i.kind, i.payment, i.balance])).toEqual([
      ['repair', 'credit', 300000],
      ['sale', 'paid', 0],
    ])
    expect(body.summary).toMatchObject({ owed: 300000, salesCount: 1, repairsCount: 1 })
    expect(estado.filtros).toContainEqual({ tabla: 'credit_installments', columna: 'credit_id', valor: ['c1'] })
  })
})
