import { describe, expect, it } from 'vitest'
import { dashboardProfilePatchSchema, toDashboardProfile, toProfileUpdate } from './dashboard-profile-contract'

const authUser = {
  id: 'user-1',
  email: 'ana@example.com',
  email_confirmed_at: '2026-09-27T10:00:00.000Z',
  user_metadata: {},
}

describe('dashboard profile contract', () => {
  it('hydrates nullable JSONB columns with safe defaults and Auth identity', () => {
    const result = toDashboardProfile({ id: 'user-1', full_name: 'Ana', preferences: null, social_links: null }, authUser)
    expect(result.email).toBe('ana@example.com')
    expect(result.emailVerified).toBe(true)
    expect(result.preferences).toEqual(expect.objectContaining({ notifications: true, marketingEmails: false }))
    expect(result.socialLinks).toEqual({ linkedin: '', twitter: '', github: '', instagram: '' })
  })

  it('rejects empty, privileged, unknown, and mixed patches', () => {
    expect(dashboardProfilePatchSchema.safeParse({}).success).toBe(false)
    expect(dashboardProfilePatchSchema.safeParse({ role: 'super_admin' }).success).toBe(false)
    expect(dashboardProfilePatchSchema.safeParse({ fullName: 'Ana', status: 'active' }).success).toBe(false)
    expect(dashboardProfilePatchSchema.safeParse({ id: 'other-user', bio: 'Hola' }).success).toBe(false)
  })

  it('validates bounded fields, URLs, timezone, and social links', () => {
    expect(dashboardProfilePatchSchema.safeParse({ fullName: ' Ana ', timezone: 'America/Asuncion' }).success).toBe(true)
    expect(dashboardProfilePatchSchema.safeParse({ fullName: 'A' }).success).toBe(false)
    expect(dashboardProfilePatchSchema.safeParse({ website: 'javascript:alert(1)' }).success).toBe(false)
    expect(dashboardProfilePatchSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false)
    expect(dashboardProfilePatchSchema.safeParse({ socialLinks: { linkedin: 'javascript:alert(1)' } }).success).toBe(false)
  })

  it('maps only allowlisted database columns and trims values', () => {
    const parsed = dashboardProfilePatchSchema.parse({
      fullName: ' Ana Pérez ',
      phone: ' +595 981 ',
      preferences: { notifications: false },
    })
    expect(toProfileUpdate(parsed)).toEqual({
      full_name: 'Ana Pérez',
      phone: '+595 981',
      preferences: { notifications: false },
    })
  })
})
