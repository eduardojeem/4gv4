import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()

describe('atomic POS store-credit contract', () => {
  it('passes store credit through the sale API to the v4 transaction', () => {
    const route = readFileSync(resolve(workspace, 'src/app/api/pos/process-sale/route.ts'), 'utf8')

    expect(route).toContain('p_store_credit_amount?: unknown')
    expect(route).toContain("rpc('process_pos_sale_atomic_v4'")
    expect(route).toContain('p_store_credit_amount: storeCreditAmount')
    expect(route).toContain('STORE_CREDIT_CUSTOMER_REQUIRED')
    expect(route).toContain('STORE_CREDIT_EXCEEDS_BALANCE')
  })

  it('keeps the sale and ledger debit in one database transaction', () => {
    const migration = readFileSync(
      resolve(workspace, 'supabase/migrations/20260816153000_atomic_pos_store_credit.sql'),
      'utf8'
    )

    expect(migration).toContain('process_pos_sale_atomic_v4')
    expect(migration).toContain('process_pos_sale_atomic_v3(')
    expect(migration).toContain('for update')
    expect(migration).toContain("sale.customer_id is distinct from p_customer_id")
    expect(migration).toContain("source_type = 'sale'")
    expect(migration).toContain('delete from public.cash_movements')
    expect(migration).toContain("payment_index = jsonb_array_length(effective_payments) - 1")
    expect(migration).toContain('revoke all on function public.process_pos_sale_atomic_v4')
    expect(migration).toContain('grant execute on function public.process_pos_sale_atomic_v4')
  })

  it('submits only the amount still due as an external POS payment', () => {
    const page = readFileSync(resolve(workspace, 'src/app/dashboard/pos/page.tsx'), 'utf8')

    expect(page).toContain('const amountDueAfterStoreCredit = Math.max(0, cartCalculations.total - storeCreditApplied)')
    expect(page).toContain('store_credit_amount: storeCreditApplied')
    expect(page).not.toContain('await redeemStoreCredit({')
  })
})
