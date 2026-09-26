import { describe, expect, it } from 'vitest'
import { getDashboardPermissionsForOrganizationRole } from '@/lib/auth/organization-dashboard-permissions'

describe('organization dashboard permissions', () => {
  it('does not grant seller product creation through the legacy vendedor role', () => {
    const permissions = getDashboardPermissionsForOrganizationRole('seller')

    expect(permissions).toContain('products.read')
    expect(permissions).not.toContain('products.create')
    expect(permissions).toContain('orders.manage')
  })

  it('keeps manager product and cash management capabilities', () => {
    const permissions = getDashboardPermissionsForOrganizationRole('manager')

    expect(permissions).toContain('products.create')
    expect(permissions).toContain('pos.manage')
    expect(permissions).toContain('reports.read')
  })

  it('lets cashiers read repairs and confirm delivery without technical management', () => {
    const permissions = getDashboardPermissionsForOrganizationRole('cashier')

    expect(permissions).toContain('pos.read')
    expect(permissions).toContain('pos.manage')
    expect(permissions).toContain('customers.read')
    expect(permissions).not.toContain('reports.read')
    expect(permissions).toContain('repairs.read')
    expect(permissions).toContain('repairs.deliver')
    expect(permissions).not.toContain('repairs.manage')
  })
})
