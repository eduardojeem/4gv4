import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const migration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260728213000_harden_dashboard_financial_workflows.sql'),
  'utf8'
)

describe('dashboard financial workflow contracts', () => {
  it.each([
    'open_cash_register_atomic',
    'close_cash_register_atomic',
    'record_cash_count_atomic',
    'register_credit_payment_atomic',
    'decrement_pos_stock_batch_atomic',
    'create_dashboard_order_atomic',
  ])('defines the transactional function %s', (functionName) => {
    expect(migration).toContain(`function public.${functionName}`)
  })

  it('stores cash counts outside cash movements', () => {
    const cashContext = readFileSync(
      resolve(workspace, 'src/app/dashboard/pos/contexts/CashRegisterContext.tsx'),
      'utf8'
    )

    expect(cashContext).toContain("fetch('/api/pos/cash-counts'")
    expect(cashContext).not.toContain(".from('cash_movements').insert")
  })

  it('routes POS stock and dashboard orders through atomic database functions', () => {
    const posRoute = readFileSync(
      resolve(workspace, 'src/app/api/pos/process-sale/route.ts'),
      'utf8'
    )
    const ordersRoute = readFileSync(
      resolve(workspace, 'src/app/api/orders/route.ts'),
      'utf8'
    )

    expect(posRoute).toContain("'decrement_pos_stock_batch_atomic'")
    expect(ordersRoute).toContain("'create_dashboard_order_atomic'")
  })

  it('requires an idempotency key for POS requests created by the client', () => {
    const posHook = readFileSync(resolve(workspace, 'src/hooks/usePOS.ts'), 'utf8')
    const posRoute = readFileSync(
      resolve(workspace, 'src/app/api/pos/process-sale/route.ts'),
      'utf8'
    )

    expect(posHook).toContain("'x-idempotency-key': idempotencyKey")
    expect(posRoute).toContain("request.headers.get('x-idempotency-key')")
  })
})
