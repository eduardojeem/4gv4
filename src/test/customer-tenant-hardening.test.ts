import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('customer routes enforce the active organization', () => {
  it('protects the legacy credit detail with CRM read permission', () => {
    const route = read('src/app/api/customers/[id]/credits/route.ts')
    expect(route).toContain("withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }")
    expect(route).not.toContain('requireStaff')
  })

  it('checks customer ownership before reading credits with the admin client', () => {
    const route = read('src/app/api/customers/[id]/credits/route.ts')
    expect(route).toContain(".from('customers')")
    expect(route).toContain(".eq('organization_id', organization.id)")
    expect(route).toContain(".eq('customer_id', customerId)")
    expect(route).toContain(".eq('organization_id', organization.id)")
  })

  it('scopes every history table and fails closed if any lookup errors', () => {
    const route = read('src/app/api/customers/route.ts')
    expect(route).toContain("supabase.from('customer_credits').select('customer_id').in('customer_id', ids).eq('organization_id', organizationId)")
    expect(route).toContain("supabase.from('customer_store_credits').select('customer_id').in('customer_id', ids).eq('organization_id', organizationId)")
    expect(route).toContain('const historyError = historyResults.find((result) => result.error)?.error')
    expect(route).toContain('if (historyError) throw historyError')
    expect(route).not.toContain('salesResult.error ? null : salesResult.data')
  })

  it.each([
    'src/app/api/customers/[id]/create-account/route.ts',
    'src/app/api/customers/[id]/link-account/route.ts',
  ])('requires customer-management permission in %s', (path) => {
    const route = read(path)
    expect(route).toContain("withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }")
    expect(route).not.toContain('requireStaff')
  })

  it('removes only the customer membership when unlinking an account', () => {
    const route = read('src/app/api/customers/[id]/link-account/route.ts')
    expect(route).toContain(".from('organization_members')")
    expect(route).toContain(".eq('role', 'customer')")
    expect(route).toContain(".eq('organization_id', organization.id)")
    expect(route).toContain(".eq('user_id', customer.profile_id)")
  })

  it('actually requests the recovery email before claiming it was sent', () => {
    const route = read('src/app/api/customers/[id]/create-account/route.ts')
    expect(route).toContain('resetPasswordForEmail(email')
    expect(route).not.toContain('auth.admin.generateLink')
  })

  it('links the customer and membership atomically after account creation', () => {
    const route = read('src/app/api/customers/[id]/create-account/route.ts')
    expect(route).toContain('linkPublicCustomerAccount(supabase')
    expect(route).not.toContain("supabase.from('organization_members').upsert")
  })
})
