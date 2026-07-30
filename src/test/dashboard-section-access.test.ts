import { describe, expect, it } from 'vitest'
import {
  canRoleAccessSection,
  mapOrganizationRoleToDashboardRole,
} from '@/lib/auth/section-access'

describe('dashboard section access', () => {
  it.each([
    ['owner', 'admin'],
    ['admin', 'admin'],
    ['manager', 'vendedor'],
    ['cashier', 'vendedor'],
    ['seller', 'vendedor'],
    ['technician', 'tecnico'],
    ['customer', 'cliente'],
  ] as const)('maps organization role %s to %s', (organizationRole, expectedRole) => {
    expect(mapOrganizationRoleToDashboardRole(organizationRole)).toBe(expectedRole)
  })

  it('fails closed for a customer profile on dashboard sections', () => {
    expect(canRoleAccessSection('cliente', '/dashboard')).toBe(false)
    expect(canRoleAccessSection('cliente', '/dashboard/products')).toBe(false)
  })

  it('aligns seller read sections with the permission matrix', () => {
    expect(canRoleAccessSection('vendedor', '/dashboard/products')).toBe(true)
    expect(canRoleAccessSection('vendedor', '/dashboard/categories')).toBe(true)
    expect(canRoleAccessSection('vendedor', '/dashboard/promotions')).toBe(true)
    expect(canRoleAccessSection('vendedor', '/dashboard/reports')).toBe(true)
  })

  it('allows technicians to inspect products and reports without granting orders', () => {
    expect(canRoleAccessSection('tecnico', '/dashboard/products')).toBe(true)
    expect(canRoleAccessSection('tecnico', '/dashboard/categories')).toBe(true)
    expect(canRoleAccessSection('tecnico', '/dashboard/reports')).toBe(true)
    expect(canRoleAccessSection('tecnico', '/dashboard/orders')).toBe(false)
  })
})
