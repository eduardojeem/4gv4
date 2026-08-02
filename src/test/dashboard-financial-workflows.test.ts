import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const migration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260728213000_harden_dashboard_financial_workflows.sql'),
  'utf8'
)
const posAtomicMigration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260731215500_make_pos_sale_atomic.sql'),
  'utf8'
)
const cashRegisterMigration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260802004403_harden_pos_cash_register.sql'),
  'utf8'
)
const paymentReconciliationMigration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260802013141_add_pos_payment_reconciliation.sql'),
  'utf8'
)
const cashRegisterActiveContractMigration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260802180000_fix_cash_register_active_contract.sql'),
  'utf8'
)
const cashMovementEnumCastMigration = readFileSync(
  resolve(workspace, 'supabase/migrations/20260802193000_fix_cash_movement_enum_cast.sql'),
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

  it('defines the complete POS sale transaction', () => {
    expect(posAtomicMigration).toContain('function public.process_pos_sale_atomic_v2')
    expect(posAtomicMigration).toContain('insert into public.sale_payments')
    expect(posAtomicMigration).toContain('insert into public.cash_movements')
    expect(posAtomicMigration).toContain('BRANCH_INVENTORY_NOT_CONFIGURED')
    expect(posAtomicMigration).toContain('selected_product.sale_price')
    expect(posAtomicMigration).toContain('p_order_discount_rate')
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

    expect(posRoute).toContain("'process_pos_sale_atomic_v3'")
    expect(ordersRoute).toContain("'create_dashboard_order_atomic'")
  })

  it('requires an idempotency key for POS requests created by the client', () => {
    const posHook = readFileSync(resolve(workspace, 'src/hooks/usePOSProducts.ts'), 'utf8')
    const posRoute = readFileSync(
      resolve(workspace, 'src/app/api/pos/process-sale/route.ts'),
      'utf8'
    )

    expect(posHook).toContain("'x-idempotency-key': idempotencyKey")
    expect(posRoute).toContain("request.headers.get('x-idempotency-key')")
  })

  it('commits the active POS workflow through one tenant-authorized transaction', () => {
    const posPage = readFileSync(resolve(workspace, 'src/app/dashboard/pos/page.tsx'), 'utf8')
    const posRoute = readFileSync(
      resolve(workspace, 'src/app/api/pos/process-sale/route.ts'),
      'utf8'
    )

    expect(posRoute).toContain("permission: 'pos.sales.create'")
    expect(posRoute).toContain("'process_pos_sale_atomic_v3'")
    expect(posPage).not.toContain('await persistSaleToSupabase(')
    expect(posPage).not.toContain('syncSaleWithCashRegister(')
    expect(posPage).not.toContain(".from('sales').insert")
  })

  it('keeps payment splits in the active POS request', () => {
    const posHook = readFileSync(resolve(workspace, 'src/hooks/usePOSProducts.ts'), 'utf8')
    const posRoute = readFileSync(
      resolve(workspace, 'src/app/api/pos/process-sale/route.ts'),
      'utf8'
    )

    expect(posHook).toContain('p_payments: saleData.payments')
    expect(posRoute).toContain('normalizePayments')
    expect(posRoute).toContain('p_payments: payments')
  })

  it('counts only physical cash sales in counts and closures', () => {
    expect(cashRegisterMigration).toContain("m.type = 'sale' and coalesce(m.payment_method, 'cash') = 'cash'")
    expect(cashRegisterMigration).toContain('create or replace function public.close_cash_register_atomic')
    expect(cashRegisterMigration).toContain('create or replace function public.record_cash_count_atomic')
  })

  it('validates that an opened register belongs to the selected branch', () => {
    expect(cashRegisterMigration).toContain('from public.cash_registers r')
    expect(cashRegisterMigration).toContain('r.branch_id = p_branch_id')
    expect(cashRegisterMigration).toContain("r.id::text = trim(p_register_id)")
  })

  it('keeps the cash-register active-state schema compatible with cash opening', () => {
    expect(cashRegisterActiveContractMigration).toContain('add column if not exists is_active boolean')
    expect(cashRegisterActiveContractMigration).toContain('alter column is_active set default true')
    expect(cashRegisterActiveContractMigration).toContain('alter column is_active set not null')
    expect(cashRegisterActiveContractMigration).toContain("c.register_id = 'principal'")
    expect(cashRegisterActiveContractMigration).toContain('public.calculate_cash_session_expected')
  })

  it('casts the cash movement enum before calculating its register effect', () => {
    expect(cashRegisterMigration).toContain('cash_movement_effect(new.type::text')
    expect(cashMovementEnumCastMigration).toContain('cash_movement_effect(new.type::text')
    expect(cashMovementEnumCastMigration).toContain('create or replace function public.sync_cash_register_balance_from_movement')
  })

  it('routes manual cash movements through a protected atomic endpoint', () => {
    const movementRoute = readFileSync(
      resolve(workspace, 'src/app/api/pos/cash-movements/route.ts'),
      'utf8'
    )
    const cashHook = readFileSync(resolve(workspace, 'src/hooks/useCashRegister.ts'), 'utf8')

    expect(cashRegisterMigration).toContain('function public.record_cash_movement_atomic')
    expect(cashRegisterMigration).toContain('drop policy if exists "cash managers can create cash movements"')
    expect(movementRoute).toContain("permission: 'pos.cash.manage'")
    expect(movementRoute).toContain("'record_cash_movement_atomic'")
    expect(cashHook).toContain("fetch('/api/pos/cash-movements'")
    expect(cashHook).not.toContain(".from('cash_movements')\n                .insert")
  })

  it('stores electronic payment reconciliation details without card secrets', () => {
    expect(paymentReconciliationMigration).toContain('reconciliation_status')
    expect(paymentReconciliationMigration).toContain('fee_amount')
    expect(paymentReconciliationMigration).toContain('net_amount')
    expect(paymentReconciliationMigration).toContain('provider')
    expect(paymentReconciliationMigration).toContain('institution')
    expect(paymentReconciliationMigration).toContain('terminal_id')
    expect(paymentReconciliationMigration).not.toContain('card_number')
    expect(paymentReconciliationMigration).not.toContain('cvv')
  })

  it('defines tenant-scoped payment metadata and reconciliation operations', () => {
    expect(paymentReconciliationMigration).toContain('function public.apply_pos_payment_metadata_atomic')
    expect(paymentReconciliationMigration).toContain('function public.reconcile_sale_payment_atomic')
    expect(paymentReconciliationMigration).toContain("has_org_permission(p_organization_id, 'pos.cash.manage')")
    expect(paymentReconciliationMigration).toContain('user_has_branch_access(p_branch_id)')
    expect(paymentReconciliationMigration).toContain('p_branch_id')
  })

  it('exposes protected electronic payment APIs and a cash-register view', () => {
    const route = readFileSync(
      resolve(workspace, 'src/app/api/pos/electronic-payments/route.ts'),
      'utf8'
    )
    const panel = readFileSync(
      resolve(workspace, 'src/app/dashboard/pos/caja/components/ElectronicPaymentsPanel.tsx'),
      'utf8'
    )
    const cashPage = readFileSync(resolve(workspace, 'src/app/dashboard/pos/caja/page.tsx'), 'utf8')

    expect(route).toContain("permission: 'pos.cash.manage'")
    expect(route).toContain("'reconcile_sale_payment_atomic'")
    expect(panel).toContain("fetch('/api/pos/electronic-payments")
    expect(cashPage).toContain('ElectronicPaymentsPanel')
  })

  it('uses one guided cash-opening dialog across POS and cash management', () => {
    const dialog = readFileSync(
      resolve(workspace, 'src/app/dashboard/pos/components/OpenCashRegisterDialog.tsx'),
      'utf8'
    )
    const posPage = readFileSync(resolve(workspace, 'src/app/dashboard/pos/page.tsx'), 'utf8')
    const cashPage = readFileSync(resolve(workspace, 'src/app/dashboard/pos/caja/page.tsx'), 'utf8')
    const cashContext = readFileSync(
      resolve(workspace, 'src/app/dashboard/pos/contexts/CashRegisterContext.tsx'),
      'utf8'
    )
    const cashHook = readFileSync(resolve(workspace, 'src/hooks/useCashRegister.ts'), 'utf8')

    expect(dialog).toContain('Fondo inicial')
    expect(dialog).toContain('Montos rápidos')
    expect(dialog).toContain('quickAmounts.map')
    expect(dialog).toContain('Resumen de apertura')
    expect(dialog).toContain('selectedBranch?.name')
    expect(dialog).toContain('Se creará Caja Principal')
    expect(posPage).toContain('<OpenCashRegisterDialog')
    expect(cashPage).toContain('<OpenCashRegisterDialog')
    expect(cashContext).toContain('const availableRegisters = await loadRegisters()')
    expect(cashContext).toContain("fetch('/api/pos/cash-registers'")
    expect(cashContext).toContain("name: 'Caja Principal'")
    expect(cashHook).toContain("if (!registerId.trim())")
    expect(cashHook).not.toContain("const fallback = [{ id: 'principal'")
  })

  it('commits payment metadata and paid-repair protection in the POS transaction', () => {
    const route = readFileSync(resolve(workspace, 'src/app/api/pos/process-sale/route.ts'), 'utf8')
    const atomicCheckoutMigration = readFileSync(
      resolve(workspace, 'supabase/migrations/20260802133000_finalize_pos_checkout_atomic.sql'),
      'utf8'
    )

    expect(route).toContain("'process_pos_sale_atomic_v3'")
    expect(route).not.toContain("supabase.rpc('apply_pos_payment_metadata_atomic'")
    expect(atomicCheckoutMigration).toContain('function public.process_pos_sale_atomic_v3')
    expect(atomicCheckoutMigration).toContain('REPAIR_ALREADY_PAID')
    expect(atomicCheckoutMigration).toContain('for update')
    expect(atomicCheckoutMigration).toContain('apply_pos_payment_metadata_atomic')
  })

  it('connects checkout discount and paid-repair filtering to persisted fields', () => {
    const posPage = readFileSync(resolve(workspace, 'src/app/dashboard/pos/page.tsx'), 'utf8')
    const checkout = readFileSync(
      resolve(workspace, 'src/app/dashboard/pos/components/CheckoutModal.tsx'),
      'utf8'
    )

    expect(posPage).toContain('discount={generalDiscount}')
    expect(posPage).toContain('onDiscountChange={setGeneralDiscount}')
    expect(posPage).toContain('payment_status')
    expect(checkout).toContain("repair.payment_status !== 'pagado'")
  })
})
