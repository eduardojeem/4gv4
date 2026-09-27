import { describe, expect, it } from 'vitest'
import {
  canAssignRoleFromUserManagement,
  getManagedRoleLabel,
  isProtectedOrganizationOwner,
  normalizeManagedUserRole,
} from '@/lib/auth/organization-owner-policy'

describe('organization owner policy', () => {
  it('keeps owner distinct from admin', () => {
    expect(normalizeManagedUserRole('owner')).toBe('owner')
    expect(normalizeManagedUserRole('admin')).toBe('admin')
    expect(getManagedRoleLabel('owner')).toBe('Propietario')
    expect(getManagedRoleLabel('admin')).toBe('Administrador')
  })

  it('protects an existing owner from common user management', () => {
    expect(isProtectedOrganizationOwner('owner')).toBe(true)
    expect(isProtectedOrganizationOwner('admin')).toBe(false)
  })

  it('does not allow assigning owner from common user management', () => {
    expect(canAssignRoleFromUserManagement('owner')).toBe(false)
    expect(canAssignRoleFromUserManagement('admin')).toBe(true)
  })

  it('preserves legacy role mappings used by existing accounts', () => {
    expect(normalizeManagedUserRole('manager')).toBe('vendedor')
    expect(normalizeManagedUserRole('technician')).toBe('tecnico')
    expect(normalizeManagedUserRole('mayorista')).toBe('cliente')
    expect(normalizeManagedUserRole('client_normal')).toBe('cliente')
  })
})
