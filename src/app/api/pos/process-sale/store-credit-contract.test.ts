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

  it('uses the post-credit balance for mixed validation and receipt payments', () => {
    const page = readFileSync(resolve(workspace, 'src/app/dashboard/pos/page.tsx'), 'utf8')

    expect(page).toContain('getMixedPaymentValidation(amountDueAfterStoreCredit, paymentSplit)')
    expect(page).toContain('buildPosCreditSummary(amountDueAfterStoreCredit, creditTerms)')
    expect(page).toContain('const receiptPaymentAmount = creditSummaryForReceipt?.financedTotal ?? amountDueAfterStoreCredit')
    expect(page).toContain("method: 'store_credit' as const")
  })

  it('never falls back to v3 when store credit must be debited', () => {
    const route = readFileSync(resolve(workspace, 'src/app/api/pos/process-sale/route.ts'), 'utf8')

    expect(route).toContain('storeCreditAmount <= 0 && rpcResponse.error')
  })

  it('keeps checkout open while processing and exposes a mobile action bar', () => {
    const modal = readFileSync(resolve(workspace, 'src/app/dashboard/pos/components/CheckoutModal.tsx'), 'utf8')

    expect(modal).toContain("if (!open && paymentStatus !== 'processing') onCancel()")
    expect(modal).toContain('max-sm:h-[100dvh]')
    expect(modal).toContain('data-testid="pos-checkout-actions"')
    expect(modal).toContain('max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0')
  })

  it('guides checkout through customer, payment and confirmation with secondary options collapsed', () => {
    const modal = readFileSync(resolve(workspace, 'src/app/dashboard/pos/components/CheckoutModal.tsx'), 'utf8')
    const methods = readFileSync(resolve(workspace, 'src/app/dashboard/pos/components/checkout/PaymentMethods.tsx'), 'utf8')

    expect(modal).toContain('1. Cliente')
    expect(modal).toContain('2. Forma de cobro')
    expect(modal).toContain('3. Revisar y confirmar')
    expect(modal).toContain('Opciones adicionales')
    expect(modal).toContain('data-testid="pos-checkout-footer"')
    expect(methods).toContain('grid-cols-2 sm:grid-cols-4')
  })
})
