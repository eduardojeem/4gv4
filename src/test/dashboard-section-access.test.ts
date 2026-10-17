import { roleHasPermission } from '@/lib/saas/permissions'
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
    expect(canRoleAccessSection('vendedor', '/dashboard/reports')).toBe(false)
  })

  it('allows technicians to inspect products and reports without granting orders', () => {
    expect(canRoleAccessSection('tecnico', '/dashboard/products')).toBe(true)
    expect(canRoleAccessSection('tecnico', '/dashboard/categories')).toBe(true)
    expect(canRoleAccessSection('tecnico', '/dashboard/reports')).toBe(false)
    expect(canRoleAccessSection('tecnico', '/dashboard/orders')).toBe(false)
  })
})


describe('active membership permissions override only the matching operational sections', () => {
  it('admits managers to analytics and technician assignment without settings', () => {
    const can = (permission: string) => roleHasPermission('manager', permission as Parameters<typeof roleHasPermission>[1])
    expect(canRoleAccessSection('vendedor', '/dashboard/repairs/analytics', can)).toBe(true)
    expect(canRoleAccessSection('vendedor', '/dashboard/repairs/technicians', can)).toBe(true)
    expect(canRoleAccessSection('vendedor', '/dashboard/settings', can)).toBe(false)
    expect(canRoleAccessSection('vendedor', '/dashboard/repairs/settings', can)).toBe(false)
  })
  it('keeps cashiers out of analytics and assignment', () => {
    const can = (permission: string) => roleHasPermission('cashier', permission as Parameters<typeof roleHasPermission>[1])
    expect(canRoleAccessSection('vendedor', '/dashboard/repairs/analytics', can)).toBe(false)
    expect(canRoleAccessSection('vendedor', '/dashboard/repairs/technicians', can)).toBe(false)
  })
})
