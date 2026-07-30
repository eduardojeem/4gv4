import { describe, expect, it } from 'vitest'
import {
  canWriteGlobalUserIdentity,
  mapAppRoleToOrganizationRole,
} from '@/lib/auth/admin-role-scope'

describe('admin role scope', () => {
  it('reserves global identity writes for super administrators', () => {
    expect(canWriteGlobalUserIdentity('super_admin')).toBe(true)
    expect(canWriteGlobalUserIdentity('admin')).toBe(false)
    expect(canWriteGlobalUserIdentity('cliente')).toBe(false)
  })

  it('maps application roles to organization membership roles', () => {
    expect(mapAppRoleToOrganizationRole('admin')).toBe('admin')
    expect(mapAppRoleToOrganizationRole('vendedor')).toBe('seller')
    expect(mapAppRoleToOrganizationRole('tecnico')).toBe('technician')
    expect(mapAppRoleToOrganizationRole('cliente')).toBe('customer')
  })

  it('does not allow super_admin as an organization membership role', () => {
    expect(() => mapAppRoleToOrganizationRole('super_admin')).toThrow(
      'super_admin is a global role'
    )
  })
})
