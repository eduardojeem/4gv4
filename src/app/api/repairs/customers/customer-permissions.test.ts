import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('repair customer database permissions', () => {
  it('allows repair-order creators to insert and read customers through RLS', () => {
    const customerPolicies = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '20260821001119_align_repair_customer_rls_permissions.sql'),
      'utf8'
    ).toLowerCase()

    expect(customerPolicies).toContain('create policy "repair staff can create customers"')
    expect(customerPolicies).toContain('create policy "repair staff can read customers"')
    expect(customerPolicies).toContain('create policy "repair staff can update customers"')
    expect(customerPolicies).toContain("has_org_permission(organization_id, 'repairs.orders.create')")
    expect(customerPolicies).toContain("has_org_permission(organization_id, 'repairs.orders.read')")
    expect(customerPolicies).toContain("has_org_permission(organization_id, 'repairs.orders.update')")
  })
})
