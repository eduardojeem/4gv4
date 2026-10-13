import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Base en memoria con lo justo del query builder de Supabase: select/eq/insert,
 * maybeSingle/single y `await` directo. Con `uniqueKeys` simula el índice único.
 */
type Row = Record<string, unknown>
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  inserts: 0,
  missingKeyColumn: false,
  rpc: vi.fn(async () => ({ data: 0, error: null })),
}))

function builder(table: string) {
  const filters: Array<[string, unknown]> = []
  let pendingInsert: Row | null = null
  const rows = () => (db.tables[table] ??= [])
  const matches = () => rows().filter((row) => filters.every(([column, value]) => row[column] === value))
  const result = (single: boolean) => {
    if (pendingInsert) {
      const values = pendingInsert
      if (db.missingKeyColumn && 'creation_idempotency_key' in values) {
        return { data: null, error: { code: 'PGRST204', message: "Could not find the 'creation_idempotency_key' column" } }
      }
      const key = values.creation_idempotency_key
      if (key && rows().some((row) => row.organization_id === values.organization_id && row.creation_idempotency_key === key)) {
        return { data: null, error: { code: '23505', message: 'duplicate key value' } }
      }
      const row = { id: `obl-${rows().length + 1}`, paid_amount: 0, ...values }
      rows().push(row)
      db.inserts += 1
      return { data: row, error: null }
    }
    const found = matches()
    return { data: single ? (found[0] ?? null) : found, error: null }
  }
  const api = {
    select: () => api,
    eq: (column: string, value: unknown) => { filters.push([column, value]); return api },
    insert: (values: Row) => { pendingInsert = values; return api },
    maybeSingle: async () => result(true),
    single: async () => result(true),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result(false)).then(resolve),
  }
  return api
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: builder }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: db.rpc }) }))

import { createObligation, generateDueRecurringObligations } from '@/lib/finance/server'

const ORG = '11111111-1111-4111-8111-111111111111'
const BRANCH = '22222222-2222-4222-8222-222222222222'
const CATEGORY = '33333333-3333-4333-8333-333333333333'
const rent = {
  branchId: BRANCH,
  categoryId: CATEGORY,
  amount: 1400000,
  concept: 'Alquiler del local',
  accountingDate: '2026-10-10',
}

beforeEach(() => {
  db.tables = {
    finance_categories: [{ id: CATEGORY, name: 'Alquiler', organization_id: ORG, is_active: true }],
    organization_settings: [],
    finance_obligations: [],
    finance_expense_templates: [],
  }
  db.inserts = 0
  db.missingKeyColumn = false
  db.rpc.mockClear()
})

describe('gastos duplicados', () => {
  it('el mismo envío dos veces (doble clic, reintento) crea un solo gasto', async () => {
    const first = await createObligation({ organizationId: ORG, userId: 'u1', input: rent, idempotencyKey: 'expense-abc' })
    const again = await createObligation({ organizationId: ORG, userId: 'u1', input: rent, idempotencyKey: 'expense-abc' })
    expect(db.inserts).toBe(1)
    expect((again as Row).id).toBe((first as Row).id)
    expect((again as Row).outstanding_amount).toBe(1400000)
  })

  it('otro envío (otra clave) sí es otro gasto', async () => {
    await createObligation({ organizationId: ORG, userId: 'u1', input: rent, idempotencyKey: 'expense-abc' })
    await createObligation({ organizationId: ORG, userId: 'u1', input: rent, idempotencyKey: 'expense-def' })
    expect(db.inserts).toBe(2)
  })

  it('la misma clave con otros datos se rechaza en vez de devolver otro gasto', async () => {
    await createObligation({ organizationId: ORG, userId: 'u1', input: rent, idempotencyKey: 'expense-abc' })
    await expect(
      createObligation({ organizationId: ORG, userId: 'u1', input: { ...rent, amount: 140000 }, idempotencyKey: 'expense-abc' }),
    ).rejects.toMatchObject({ status: 409, code: 'FINANCE_IDEMPOTENCY_KEY_REUSED' })
    expect(db.inserts).toBe(1)
  })

  it('sin la migración aplicada, el gasto se guarda igual', async () => {
    db.missingKeyColumn = true
    await createObligation({ organizationId: ORG, userId: 'u1', input: rent, idempotencyKey: 'expense-abc' })
    expect(db.inserts).toBe(1)
    expect(db.tables.finance_obligations[0]).not.toHaveProperty('creation_idempotency_key')
  })

  it('no deja crear un segundo recurrente igual al que ya está activo', async () => {
    db.tables.finance_expense_templates.push({
      id: 't1', organization_id: ORG, branch_id: BRANCH, category_id: CATEGORY, frequency: 'monthly', status: 'active',
      concept: 'alquiler  DEL local', amount: 1400000, starts_on: '2026-10-01', ends_on: null, creation_idempotency_key: 'expense-old',
    })
    await expect(
      createObligation({
        organizationId: ORG,
        userId: 'u1',
        input: { ...rent, recurrence: { frequency: 'monthly', startsOn: '2026-11-01' } },
        idempotencyKey: 'expense-new',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'FINANCE_RECURRING_DUPLICATE' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('el reintento del mismo recurrente no se toma como duplicado', async () => {
    db.tables.finance_expense_templates.push({
      id: 't1', organization_id: ORG, branch_id: BRANCH, category_id: CATEGORY, frequency: 'monthly', status: 'active',
      concept: 'Alquiler del local', amount: 1400000, starts_on: '2026-10-01', ends_on: null, creation_idempotency_key: 'expense-same',
    })
    db.rpc.mockResolvedValueOnce({ data: { obligation: { id: 'obl-x' } }, error: null } as never)
    await createObligation({
      organizationId: ORG,
      userId: 'u1',
      input: { ...rent, recurrence: { frequency: 'monthly', startsOn: '2026-10-01' } },
      idempotencyKey: 'expense-same',
    })
    expect(db.rpc).toHaveBeenCalledWith('create_recurring_finance_obligation_atomic', expect.objectContaining({ p_idempotency_key: 'expense-same' }))
  })

  it('los recurrentes generan el gasto del período, y un error de permisos no rompe la lista', async () => {
    db.rpc.mockResolvedValueOnce({ data: 2, error: null } as never)
    await expect(generateDueRecurringObligations(ORG)).resolves.toBe(2)
    expect(db.rpc).toHaveBeenCalledWith('generate_recurring_finance_obligations', expect.objectContaining({ p_organization_id: ORG }))

    db.rpc.mockResolvedValueOnce({ data: null, error: { message: 'FINANCE_GENERATION_PERMISSION_DENIED' } } as never)
    await expect(generateDueRecurringObligations(ORG)).resolves.toBe(0)
  })
})
