import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('public customer linking contract', () => {
  it('uses one atomic customer-link operation in every public account flow', () => {
    const registerRoute = read('src/app/api/public/customer-register/route.ts')
    const linkRoute = read('src/app/api/public/customer-link/route.ts')
    const orderRoute = read('src/app/api/public/orders/route.ts')

    for (const source of [registerRoute, linkRoute]) {
      expect(source).toContain('linkPublicCustomerAccount')
    }
    expect(orderRoute).toContain('create_public_order_with_customer_account_atomic')
  })

  it('keeps customer profiles unique per organization and repairs incomplete links', () => {
    const migration = read('supabase/migrations/20260802161753_link_public_customers_atomically.sql')

    expect(migration).toContain('idx_customers_org_profile_id')
    expect(migration).toContain('organization_id, profile_id')
    expect(migration).toContain('link_public_customer_account')
    expect(migration).toContain("where om.role = 'customer'")
    expect(migration).not.toContain('public.user_role')
    expect(migration).not.toContain('delete from public.customers')
  })

  it('loads and creates POS customers only through the tenant-aware customers API', () => {
    const page = read('src/app/dashboard/pos/page.tsx')
    const context = read('src/app/dashboard/pos/contexts/POSCustomerContext.tsx')
    const selection = read('src/app/dashboard/pos/components/checkout/CustomerSelection.tsx')
    const customersRoute = read('src/app/api/customers/route.ts')

    expect(page).not.toContain(".from('customers')")
    expect(context).toContain('fetch(`/api/customers?page=${page}&limit=200`')
    expect(context).toContain("fetch('/api/customers',")
    expect(context).not.toContain(".from('customers')")
    expect(selection).not.toContain('<CustomerProvider>')
    expect(selection).not.toContain('<CustomerSyncSection')
    expect(customersRoute).toContain("permission: ['crm.customers.manage', 'pos.sales.create']")
  })
})
